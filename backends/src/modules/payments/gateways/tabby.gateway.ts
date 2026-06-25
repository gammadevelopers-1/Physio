import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  BnplPaymentGateway,
  CreateChargeParams,
  ChargeResult,
  RefundParams,
  RefundResult,
  WebhookResult,
  GatewayHealthResult,
  NormalizedPaymentStatus,
  SupportedPaymentMethod,
  InstallmentOption,
} from './payment-gateway.interface';
import { BaseGateway } from './base.gateway';
import { PaymentGatewayError } from './payment-gateway.error';
import { GatewayCredentialsService } from './gateway-credentials.service';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

@Injectable()
export class TabbyGateway extends BaseGateway implements BnplPaymentGateway {
  readonly name = 'tabby' as const;
  readonly isBnpl = true as const;
  readonly deductionRate = 0.10;
  protected readonly logger = new Logger(TabbyGateway.name);

  constructor(private readonly credentials: GatewayCredentialsService) {
    super();
  }

  // See MoyasarGateway for the rationale on getter-backed credentials.
  private get secretKey(): string { return this.credentials.getTabby().secretKey; }
  private get publicKey(): string { return this.credentials.getTabby().publicKey; }
  private get webhookSecret(): string { return this.credentials.getTabby().webhookSecret; }
  private get apiUrl(): string { return this.credentials.getTabby().apiUrl; }
  private get merchantCode(): string { return this.credentials.getTabby().merchantCode; }

  getInstallmentOptions(amount: number, currency: string): InstallmentOption[] {
    return [
      { installments: 4, monthlyAmount: +(amount / 4).toFixed(2), totalAmount: amount, currency },
    ];
  }

  /**
   * Background pre-scoring per https://docs.tabby.ai/pay-in-4-custom-integration/checkout-flow#background-pre-scoring-check
   *
   * Sends a real Tabby session-create request (Tabby has no dry-run mode)
   * and inspects the response for status='rejected'. Returns a simple
   * eligibility verdict the frontend can use to hide / disable the Tabby
   * radio BEFORE the buyer clicks Pay Now.
   *
   * No throw on rejection — eligibility is just a return value here so
   * callers don't have to wrap in try/catch. HTTP / network failures DO
   * throw (so the FE can fail-open and still show Tabby rather than
   * hiding it because of an unrelated network blip).
   */
  async prescore(params: CreateChargeParams): Promise<{
    eligible: boolean;
    reason?: string;
    message?: string;
  }> {
    if (!this.merchantCode) {
      // Fail-open: treat as eligible so the radio renders. The actual
      // Pay Now click will surface the misconfiguration with a clear error.
      return { eligible: true };
    }

    // Use the same body builder as createCharge but with a placeholder
    // paymentId — the response is inspected and discarded; we never store
    // a payments row from a prescore.
    const body = this.buildCheckoutBody(params);

    const response = await this.fetchWithRetry(`${this.apiUrl}/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Don't penalise the buyer for Tabby being temporarily down — show
      // the radio and let the Pay Now flow surface the actual error.
      this.logger.warn(
        `Tabby prescore HTTP ${response.status}: ${JSON.stringify(data)} — failing open (Tabby will stay visible)`,
      );
      return { eligible: true };
    }

    if (data?.status === 'rejected') {
      const reason =
        data?.configuration?.products?.installments?.rejection_reason ||
        data?.configuration?.available_products?.installments?.[0]
          ?.rejection_reason ||
        data?.rejection_reason ||
        'not_available';

      this.logger.log(
        `Tabby prescore REJECTED: reason=${reason} amount=${params.amount} ${params.currency} phone=${(params.customerPhone || '').slice(0, 5)}***`,
      );

      const messages: Record<string, { en: string; ar: string }> = {
        not_available: {
          en: 'Sorry, Tabby is unable to approve this purchase. Please use an alternative payment method for your order.',
          ar: 'نأسف، تابي غير قادرة على الموافقة على هذه العملية. الرجاء استخدام وسيلة دفع أخرى.',
        },
        order_amount_too_high: {
          en: 'This purchase is above your current spending limit with Tabby — try a smaller cart or use another payment method.',
          ar: 'هذا الطلب يتجاوز حد الإنفاق المتاح لك مع تابي — جرّب سلة أصغر أو استخدم وسيلة دفع أخرى.',
        },
        order_amount_too_low: {
          en: 'The purchase amount is below the minimum required to use Tabby — try adding more items or use another payment method.',
          ar: 'مبلغ الطلب أقل من الحد الأدنى المطلوب لاستخدام تابي — جرّب إضافة المزيد من العناصر أو استخدم وسيلة دفع أخرى.',
        },
      };
      const localeKey = params.locale === 'ar' ? 'ar' : 'en';
      const messageBundle = messages[reason] || messages.not_available;
      return { eligible: false, reason, message: messageBundle[localeKey] };
    }

    this.logger.log(
      `Tabby prescore ELIGIBLE: amount=${params.amount} ${params.currency}`,
    );
    return { eligible: true };
  }

  /**
   * Build the POST /api/v2/checkout body. Extracted so both createCharge
   * (real payment flow) and prescore (background eligibility check) use the
   * exact same payload shape — Tabby's underwriting reads every field, so
   * a prescore that omitted attachment / order_history would give a
   * different verdict than the real Pay-Now session.
   */
  private buildCheckoutBody(params: CreateChargeParams): Record<string, unknown> {
    // Build order_history from the buyer-history snapshot computed in
    // payments.service. Each past order needs buyer + shipping_address +
    // at least one item per Tabby's schema; we re-use the current buyer's
    // contact info (Tabby just wants something coherent — it's not used to
    // contact past buyers) and the digital-delivery shipping placeholder.
    const buyerForHistory = {
      name: params.customerName,
      email: params.customerEmail,
      phone: params.customerPhone || '',
    };
    const shippingForHistory = {
      city: 'Riyadh',
      address: 'Digital Delivery',
      zip: '11111',
    };
    const orderHistory = (params.buyerHistory?.pastOrders || []).map((o) => ({
      purchased_at: o.purchasedAt,
      amount: o.amount,
      status: o.status,
      buyer: buyerForHistory,
      shipping_address: shippingForHistory,
      items: [
        {
          title: o.itemTitle,
          quantity: 1,
          unit_price: o.amount,
          category: 'Education',
        },
      ],
    }));

    // Educational `attachment` is required for course-based merchants —
    // Tabby uses the program length + student payment-track to refine
    // approvals. We don't track per-student late-payment stats internally,
    // so populate zeros over a 12-month window (Tabby treats a clean
    // record positively; faked-positive numbers would be dishonest).
    const ed = params.educationDetails;
    const attachment = ed
      ? {
          content_type: 'application/vnd.tabby.v1+json',
          body: JSON.stringify({
            education_details: {
              merchant_subtype: ed.merchantSubtype,
              program: {
                // Tabby Pay-in-4 = 4 fortnightly instalments ≈ 2 months.
                payment_tenure_months: 2,
                months_to_completion: ed.monthsToCompletion,
              },
              student_history: {
                late_payments_count: 0,
                avg_overdue_duration_days: 0,
                observation_window_months: 12,
              },
            },
          }),
        }
      : undefined;

    return {
      payment: {
        amount: params.amount.toFixed(2),
        currency: params.currency,
        description: params.description,
        buyer: {
          name: params.customerName,
          email: params.customerEmail,
          phone: params.customerPhone || '',
        },
        order: {
          reference_id: params.metadata.paymentId,
          items: [
            {
              title: params.description,
              // Tabby's docs list this as optional, but it surfaces in their
              // refund / dispute UI when set — pass courseId so finance can
              // trace a line item back to a course without joining tables.
              reference_id: params.metadata.courseId,
              quantity: 1,
              unit_price: params.amount.toFixed(2),
              category: 'Education',
            },
          ],
        },
        // Real registration timestamp feeds Tabby's risk model; passing
        // "now" (the old default) made every buyer look brand-new and
        // hurt approvals for established customers.
        // loyalty_level counts the user's prior successful purchases across
        // ALL gateways — Tabby calls this out as one of the strongest
        // approval signals (was hardcoded 0).
        buyer_history: {
          registered_since:
            params.customerRegisteredSince || new Date().toISOString(),
          loyalty_level: params.buyerHistory?.loyaltyLevel ?? 0,
        },
        // Up to 10 prior orders (any status, any gateway) — required field
        // per Tabby's QA. Empty array is acceptable for first-time buyers.
        order_history: orderHistory,
        shipping_address: {
          city: 'Riyadh',
          address: 'Digital Delivery',
          zip: '11111',
        },
        ...(attachment ? { attachment } : {}),
        meta: params.metadata,
      },
      lang: params.locale || 'en',
      merchant_code: this.merchantCode,
      // success goes to our /payment/callback handler. cancel + failure both
      // send the buyer back to the checkout page (params.cancelUrl) so they
      // can pick a different gateway or retry — without that fallback the
      // old code's string-replace was a no-op (the redirect URL has no
      // status=paid substring) and every outcome landed on the success spinner.
      merchant_urls: {
        success: params.redirectUrl,
        cancel: params.cancelUrl || params.redirectUrl,
        failure: params.cancelUrl || params.redirectUrl,
      },
    };
  }

  async createCharge(params: CreateChargeParams): Promise<ChargeResult> {
    if (!this.merchantCode) {
      throw new PaymentGatewayError(
        'tabby',
        'TABBY_MERCHANT_CODE is not configured',
        'gateway_error',
      );
    }

    const body = this.buildCheckoutBody(params);

    const response = await this.fetchWithRetry(`${this.apiUrl}/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      this.logger.error(`Tabby createCharge failed: ${JSON.stringify(data)}`);
      const code = this.normalizeErrorCode(data.error || data.message);
      throw new PaymentGatewayError(
        'tabby',
        data.error || 'Checkout creation failed',
        code,
        data,
      );
    }

    // Pre-scoring rejection (HTTP 200 with status: 'rejected'). Per Tabby:
    //   https://docs.tabby.ai/pay-in-4-custom-integration/checkout-flow#background-pre-scoring-check
    // The response includes a rejection_reason — surface it as a distinct
    // normalized error code so the FE can show Tabby's prescribed copy for
    // that exact reason (not a generic "payment failed").
    if (data?.status === 'rejected') {
      // Reason can sit on the top-level payment or under the (now-empty)
      // installments configuration depending on Tabby's response shape.
      const reason =
        data?.configuration?.products?.installments?.rejection_reason ||
        data?.configuration?.available_products?.installments?.[0]
          ?.rejection_reason ||
        data?.rejection_reason ||
        'not_available';

      const reasonToCode: Record<
        string,
        | 'tabby_not_available'
        | 'tabby_amount_too_high'
        | 'tabby_amount_too_low'
      > = {
        not_available: 'tabby_not_available',
        order_amount_too_high: 'tabby_amount_too_high',
        order_amount_too_low: 'tabby_amount_too_low',
      };
      // Tabby's prescribed wording, verbatim (en + ar) per their docs. We
      // pick the message in the buyer's locale because this is what shows
      // up in the checkout-page error alert inline, not on a localised
      // failed-page route — backend has to emit the right string here.
      const reasonToMessage: Record<string, { en: string; ar: string }> = {
        not_available: {
          en: 'Sorry, Tabby is unable to approve this purchase. Please use an alternative payment method for your order.',
          ar: 'نأسف، تابي غير قادرة على الموافقة على هذه العملية. الرجاء استخدام وسيلة دفع أخرى.',
        },
        order_amount_too_high: {
          en: 'This purchase is above your current spending limit with Tabby — try a smaller cart or use another payment method.',
          ar: 'هذا الطلب يتجاوز حد الإنفاق المتاح لك مع تابي — جرّب سلة أصغر أو استخدم وسيلة دفع أخرى.',
        },
        order_amount_too_low: {
          en: 'The purchase amount is below the minimum required to use Tabby — try adding more items or use another payment method.',
          ar: 'مبلغ الطلب أقل من الحد الأدنى المطلوب لاستخدام تابي — جرّب إضافة المزيد من العناصر أو استخدم وسيلة دفع أخرى.',
        },
      };

      const code = reasonToCode[reason] || 'tabby_not_available';
      const localeKey = params.locale === 'ar' ? 'ar' : 'en';
      const messageBundle =
        reasonToMessage[reason] || reasonToMessage.not_available;
      const message = messageBundle[localeKey];
      this.logger.warn(
        `Tabby pre-scoring rejected for buyer; reason=${reason}, code=${code}`,
      );
      throw new PaymentGatewayError('tabby', message, code, data);
    }

    // Tabby returns checkout configuration with redirect URL
    const redirectUrl =
      data.configuration?.available_products?.installments?.[0]?.web_url ||
      data.payment?.checkout_url ||
      '';

    return {
      chargeId: data.payment?.id || data.id,
      redirectUrl,
      status: 'created',
      rawResponse: data,
    };
  }

  verifyWebhook(headers: Record<string, string>, body: any): boolean {
    // Sandbox / pre-portal-configuration mode: when no webhook secret is
    // set we accept the webhook (Tabby's portal issues this after the
    // integration is approved). In production with NODE_ENV=production we
    // refuse to skip verification — a missing secret then is a config bug,
    // not a sandbox affordance.
    if (!this.webhookSecret) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          'TABBY_WEBHOOK_SECRET missing in production — rejecting webhook',
        );
        return false;
      }
      this.logger.warn(
        'TABBY_WEBHOOK_SECRET missing (non-prod) — webhook accepted without signature check',
      );
      return true;
    }

    // Tabby's webhook registration API (POST /api/v1/webhooks) takes a
    // {header: {title, value}} object and echoes it back verbatim on every
    // webhook delivery — i.e. shared-secret passthrough, NOT HMAC over the
    // body. We registered the header name as X-Tabby-Signature; legacy
    // X-Tabby-Hmac-SHA256 covers older portal configs that did sign.
    // Headers come through Express lower-cased, so check both casings.
    const received =
      headers['x-tabby-signature'] ||
      headers['X-Tabby-Signature'] ||
      headers['x-tabby-hmac-sha256'] ||
      headers['X-Tabby-Hmac-SHA256'];
    if (!received) return false;

    if (safeEqual(received, this.webhookSecret)) return true;

    // Backwards-compat: if a merchant's portal still HMAC-signs the body,
    // recompute and compare. Constant-time on the hex strings.
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const expectedHmac = createHmac('sha256', this.webhookSecret)
      .update(bodyStr)
      .digest('hex');
    return safeEqual(received, expectedHmac);
  }

  async processWebhook(body: any): Promise<WebhookResult> {
    const chargeId = body.id || body.payment?.id;
    const status = (body.status || '').toUpperCase();

    // Successful outcomes. Tabby's lifecycle splits AUTHORIZED (buyer agreed,
    // funds held) from CLOSED (merchant captured, funds settled). Refunds
    // require CLOSED — AUTHORIZED-only payments fail with "can not refund
    // payment that has no captures and not closed". Capture inline on the
    // AUTHORIZED event so the payment graduates to CLOSED before we ever
    // need to refund it. Already-captured / idempotency replays are swallowed
    // by captureOrder.
    if (status === 'AUTHORIZED') {
      const amount = Number(body.amount ?? body.payment?.amount);
      const currency = body.currency || body.payment?.currency || 'SAR';
      if (chargeId && !Number.isNaN(amount)) {
        try {
          await this.captureOrder(chargeId, amount, currency);
          this.logger.log(`Tabby payment ${chargeId} captured for ${amount} ${currency}`);
        } catch (err) {
          this.logger.error(
            `Tabby capture failed for ${chargeId}: ${(err as Error).message} — payment stays pending for retry`,
          );
          // Stay 'pending' so the webhook controller doesn't run the success
          // flow. Tabby's webhook retries will re-enter this branch.
          return {
            chargeId,
            status: 'pending',
            errorCode: 'capture_failed',
            rawData: body,
          };
        }
      }
      return { chargeId, status: 'paid', rawData: body };
    }
    if (status === 'CLOSED') {
      return { chargeId, status: 'paid', rawData: body };
    }

    if (status === 'REFUNDED') {
      return { chargeId, status: 'refunded', rawData: body };
    }

    // Terminal failures — map to distinct errorCodes so the audit log and
    // dashboard can show buyers a sensible reason instead of a generic
    // "payment failed". Mirrors what Tamara does post-T1.
    if (status === 'REJECTED') {
      return {
        chargeId,
        status: 'failed',
        errorCode: body.rejection_reason || 'rejected',
        rawData: body,
      };
    }

    if (status === 'EXPIRED') {
      return {
        chargeId,
        status: 'failed',
        errorCode: 'session_expired',
        rawData: body,
      };
    }

    if (status === 'CANCELLED' || status === 'CANCELED') {
      return {
        chargeId,
        status: 'failed',
        errorCode: 'cancelled',
        rawData: body,
      };
    }

    // CREATED / unknown — non-terminal. Controller silently drops 'pending'.
    if (status === 'CREATED' || status === '') {
      return { chargeId, status: 'pending', rawData: body };
    }

    return {
      chargeId,
      status: 'failed',
      errorCode: `unknown_status_${status.toLowerCase()}`,
      rawData: body,
    };
  }

  /**
   * Tabby's CAPTURE step — promotes an AUTHORIZED payment to CLOSED. Refunds
   * are only valid against CLOSED payments. The API is idempotent for
   * already-captured payments (returns 409); we treat that as success.
   *
   * Tabby docs: POST /payments/{id}/captures
   */
  async captureOrder(
    paymentId: string,
    amount: number,
    _currency: string,
  ): Promise<void> {
    const response = await this.fetchWithRetry(
      `${this.apiUrl}/payments/${paymentId}/captures`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: amount.toFixed(2) }),
      },
    );

    // 409 = already captured; treat as success (idempotent capture). Some
    // older sandbox responses return 400 with "already captured" in the
    // body — match on the message too.
    if (response.status === 409) {
      this.logger.log(`Tabby payment ${paymentId} was already captured (409)`);
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const msg = String(data.error || data.message || '').toLowerCase();
      if (msg.includes('already captured') || msg.includes('already closed')) {
        this.logger.log(`Tabby payment ${paymentId} already captured (per error body)`);
        return;
      }
      throw new PaymentGatewayError(
        'tabby',
        data.error || data.message || `Capture failed with HTTP ${response.status}`,
        this.normalizeErrorCode(data.error || data.message),
        data,
      );
    }
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    // Tabby rejects refunds on AUTHORIZED-only payments ("can not refund
    // payment that has no captures and not closed"). Always run capture first
    // — idempotent for payments already CLOSED, fixes the legacy ones that
    // were marked paid before we added inline capture on the webhook.
    try {
      await this.captureOrder(params.gatewayChargeId, params.amount, 'SAR');
    } catch (err) {
      this.logger.error(
        `Tabby pre-refund capture failed for ${params.gatewayChargeId}: ${(err as Error).message}`,
      );
      throw err;
    }

    // Per Tabby docs (POST /api/v2/payments/{id}/refunds):
    //   amount       — string, up to 2 decimals for SAR
    //   reference_id — idempotency key; replay-safe with the same key
    //   reason       — human-readable explanation (shown in merchant portal)
    const body: Record<string, unknown> = {
      amount: params.amount.toFixed(2),
    };
    if (params.refundId) body.reference_id = params.refundId;
    if (params.reason) body.reason = params.reason;

    const response = await this.fetchWithRetry(
      `${this.apiUrl}/payments/${params.gatewayChargeId}/refunds`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      this.logger.error(
        `Tabby refund failed (HTTP ${response.status}): ${JSON.stringify(data)}`,
      );
      // 409 is documented as "refund unavailable — payment is disputed".
      // Surface this as a distinct code so finance can tell at a glance vs.
      // a generic gateway error.
      const code =
        response.status === 409
          ? 'payment_disputed'
          : this.normalizeErrorCode(data.error || data.message);
      const message =
        response.status === 409
          ? data.error || 'Cannot refund — payment is disputed at Tabby'
          : data.error || 'Refund failed';
      throw new PaymentGatewayError('tabby', message, code, data);
    }

    // Tabby's /payments/{id}/refunds returns the updated Payment object
    // (status: CLOSED for full refund, AUTHORIZED for partial), NOT a
    // refund-shaped object with status: SUCCEEDED — verified against their
    // public docs. Refunds are documented as synchronous: "By default
    // refunds reflect instantly". So HTTP 200 is our terminal-success
    // signal, regardless of what payment.status the response carries.
    //
    // The response includes a `refunds` array; the newest entry is the
    // refund we just created. Prefer its id for cross-referencing in the
    // Tabby merchant portal over the payment id.
    const refundsArr: Array<{ id?: string }> = Array.isArray(data.refunds)
      ? data.refunds
      : [];
    const tabbyRefundId =
      refundsArr.length > 0
        ? refundsArr[refundsArr.length - 1].id
        : undefined;

    this.logger.log(
      `Tabby refund accepted for ${params.gatewayChargeId}: payment.status=${data.status}, refundId=${tabbyRefundId || 'n/a'}`,
    );
    return {
      refundId: tabbyRefundId || data.id || params.gatewayChargeId,
      status: 'succeeded',
      rawResponse: data,
    };
  }

  async getCharge(chargeId: string): Promise<any> {
    const response = await this.fetchWithTimeout(`${this.apiUrl}/payments/${chargeId}`, {
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
      },
    });

    return response.json();
  }

  async getPaymentStatus(chargeId: string): Promise<NormalizedPaymentStatus> {
    const data = await this.getCharge(chargeId);
    switch ((data.status || '').toUpperCase()) {
      case 'AUTHORIZED': case 'CLOSED': return 'paid';
      case 'CREATED': return 'pending';
      case 'REJECTED': case 'EXPIRED': return 'failed';
      case 'REFUNDED': return 'refunded';
      case 'CANCELLED': return 'cancelled';
      default: return 'unknown';
    }
  }

  async healthCheck(): Promise<GatewayHealthResult> {
    const start = Date.now();
    try {
      const res = await this.fetchWithTimeout(
        `${this.apiUrl}/merchants/${this.merchantCode || 'unknown'}`,
        { headers: { Authorization: `Bearer ${this.secretKey}` } },
        5000,
      );
      const latencyMs = Date.now() - start;
      // 404/401 = API reachable even if merchant not found in test env
      const ok = res.ok || res.status === 401 || res.status === 404;
      return {
        gateway: 'tabby',
        status: ok ? 'healthy' : 'degraded',
        latencyMs,
        ...(ok ? {} : { error: `HTTP ${res.status}` }),
        checkedAt: new Date(),
      };
    } catch (err: any) {
      return {
        gateway: 'tabby',
        status: 'down',
        latencyMs: Date.now() - start,
        error: err.message,
        checkedAt: new Date(),
      };
    }
  }

  getSupportedPaymentMethods(): SupportedPaymentMethod[] {
    return [
      {
        type: 'bnpl',
        label: 'Tabby — Pay in 4',
        currencies: ['SAR', 'AED', 'KWD', 'BHD'],
        installmentOptions: this.getInstallmentOptions(100, 'SAR'),
      },
    ];
  }
}
