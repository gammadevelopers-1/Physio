import { Injectable, Logger } from '@nestjs/common';
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

/**
 * TamaraGateway — KSA BNPL (3 monthly instalments, interest-free).
 *
 * Tamara's order lifecycle is multi-step and unforgiving:
 *
 *   buyer pays first instalment on Tamara
 *     ↓ webhook: order_approved
 *   merchant calls POST /orders/{id}/authorise         ← we MUST do this
 *     ↓ webhook: order_authorised
 *   merchant calls POST /payments/capture              ← we MUST do this
 *     ↓ webhook: order_captured
 *   money settles to merchant bank.
 *
 * If we don't authorise within 72 hours, Tamara auto-cancels and refunds the
 * buyer. The current implementation calls authorise + capture inline on the
 * order_approved webhook so the entire round-trip completes in ~2 seconds.
 * If those API calls fail, we DON'T return 'paid' to the webhook controller
 * — the payment stays in 'pending' status, Tamara's built-in webhook retry
 * fires the same order_approved event again, and we retry inline.
 *
 * Phase T2 will add a BullMQ retry queue + daily cron sweep + finance email
 * alerts for the 1% case where Tamara's own retries also fail.
 */
@Injectable()
export class TamaraGateway extends BaseGateway implements BnplPaymentGateway {
  readonly name = 'tamara' as const;
  readonly isBnpl = true as const;
  readonly deductionRate = 0.10;
  protected readonly logger = new Logger(TamaraGateway.name);

  constructor(private readonly credentials: GatewayCredentialsService) {
    super();
  }

  // See MoyasarGateway for the rationale on getter-backed credentials.
  private get apiToken(): string { return this.credentials.getTamara().apiToken; }
  private get notificationToken(): string { return this.credentials.getTamara().notificationToken; }
  private get apiUrl(): string { return this.credentials.getTamara().apiUrl; }

  getInstallmentOptions(amount: number, currency: string): InstallmentOption[] {
    return [
      { installments: 3, monthlyAmount: +(amount / 3).toFixed(2), totalAmount: amount, currency },
      { installments: 6, monthlyAmount: +(amount / 6).toFixed(2), totalAmount: amount, currency },
    ];
  }

  async createCharge(params: CreateChargeParams): Promise<ChargeResult> {
    const body = {
      order_reference_id: params.metadata.paymentId,
      total_amount: {
        amount: params.amount,
        currency: params.currency,
      },
      // tax_amount + shipping_amount are REQUIRED by Tamara's /checkout
      // endpoint even when zero. Omitting them returns HTTP 500 with the
      // generic "Something went wrong with us" message instead of a clean
      // 400 — verified empirically against api-sandbox.tamara.co.
      tax_amount: {
        amount: 0,
        currency: params.currency,
      },
      shipping_amount: {
        amount: 0,
        currency: params.currency,
      },
      description: params.description,
      country_code: 'SA',
      payment_type: 'PAY_BY_INSTALMENTS',
      instalments: 3,
      locale: params.locale || 'en_US',
      items: [
        {
          reference_id: params.metadata.courseId,
          type: 'Digital',
          name: params.description,
          // sku is REQUIRED per item (same 500-on-omit behaviour). We reuse
          // the courseId since each item maps 1:1 to a course in our model.
          sku: params.metadata.courseId,
          quantity: 1,
          unit_price: {
            amount: params.amount,
            currency: params.currency,
          },
          total_amount: {
            amount: params.amount,
            currency: params.currency,
          },
        },
      ],
      consumer: {
        first_name: params.customerName.split(' ')[0] || '',
        last_name: params.customerName.split(' ').slice(1).join(' ') || '',
        email: params.customerEmail,
        phone_number: params.customerPhone || '',
      },
      shipping_address: {
        first_name: params.customerName.split(' ')[0] || '',
        last_name: params.customerName.split(' ').slice(1).join(' ') || '',
        country_code: 'SA',
        city: 'Riyadh',
        line1: 'Digital Delivery',
      },
      // success → our /payment/callback handler. failure + cancel both send
      // the buyer back to the checkout page so they can pick a different
      // gateway or retry — the previous .replace('status=paid', ...) was
      // a no-op (the redirect URL has no status=paid substring) and every
      // outcome silently landed on the success spinner.
      merchant_url: {
        success: params.redirectUrl,
        failure: params.cancelUrl || params.redirectUrl,
        cancel: params.cancelUrl || params.redirectUrl,
        notification: params.webhookUrl,
      },
      metadata: params.metadata,
    };

    const response = await this.fetchWithRetry(`${this.apiUrl}/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      this.logger.error(`Tamara createCharge failed: ${JSON.stringify(data)}`);
      const code = this.normalizeErrorCode(data.error_code || data.message);
      throw new PaymentGatewayError(
        'tamara',
        data.message || 'Checkout creation failed',
        code,
        data,
      );
    }

    return {
      chargeId: data.order_id,
      redirectUrl: data.checkout_url || '',
      status: 'created',
      rawResponse: data,
    };
  }

  verifyWebhook(headers: Record<string, string>, _body: any): boolean {
    if (!this.notificationToken) return false;

    // Headers are normalized to lowercase by Node's http parser, but accept
    // the original-case variant defensively too.
    const token =
      headers['notification-token'] || headers['Notification-Token'];
    return token === this.notificationToken;
  }

  /**
   * Map an inbound Tamara webhook to a normalized result.
   *
   * For the critical `order_approved` event we synchronously call Authorise +
   * Capture against Tamara's API before answering "paid". If either call fails,
   * we return `pending` — Tamara will re-fire the same webhook a few times
   * (their built-in retry), and our webhook controller's dedup map only blocks
   * the same gateway+chargeId combination during the in-memory TTL, so the
   * next Tamara retry after that window will re-enter this method and try
   * again. Phase T2 adds a longer-tailed retry queue for the edge case where
   * Tamara also gives up.
   */
  async processWebhook(body: any): Promise<WebhookResult> {
    const chargeId = body.order_id || body.data?.order_id;
    const eventType = body.event_type || body.type;

    this.logger.log(
      `Tamara webhook event=${eventType} order=${chargeId}`,
    );

    // Terminal-failure events: order auto-cancelled or declined by Tamara.
    // Map each to a distinct error code so finance can tell at-a-glance why
    // the order died without digging into the raw webhook payload.
    if (eventType === 'order_declined') {
      return {
        chargeId,
        status: 'failed',
        errorCode: 'order_declined',
        rawData: body,
      };
    }
    if (eventType === 'order_expired') {
      // The 72-hour Authorise window passed without us calling Authorise.
      // Tamara has already refunded the buyer. We just mark our payment failed.
      return {
        chargeId,
        status: 'failed',
        errorCode: 'authorise_window_expired',
        rawData: body,
      };
    }
    if (eventType === 'order_canceled' || eventType === 'order_cancelled') {
      return {
        chargeId,
        status: 'failed',
        errorCode: 'order_cancelled',
        rawData: body,
      };
    }
    if (eventType === 'order_refunded') {
      return { chargeId, status: 'refunded', rawData: body };
    }

    // Already-captured event: Tamara fires this after our Capture call
    // succeeds. By the time it arrives our payment row is already PAID
    // (we flipped it in the order_approved path below), so the webhook
    // processor's idempotency guard makes this a no-op. Still respond
    // 'paid' for symmetry.
    if (eventType === 'order_captured') {
      return { chargeId, status: 'paid', rawData: body };
    }

    // Approved is the event that triggers the multi-step settlement. Run
    // Authorise → Capture inline so the entire flow completes before we
    // respond 'paid' to the webhook controller.
    if (eventType === 'order_approved' || eventType === 'order_authorised') {
      const totalAmount = body.total_amount?.amount;
      const totalCurrency = body.total_amount?.currency || 'SAR';
      if (!chargeId || totalAmount == null) {
        this.logger.error(
          `Tamara ${eventType} webhook missing order_id / total_amount: ${JSON.stringify(body)}`,
        );
        return { chargeId, status: 'failed', errorCode: 'malformed_webhook', rawData: body };
      }

      // Step 1: Authorise (idempotent on Tamara's side — calling twice
      // returns the existing authorisation, not an error). Skip if the
      // webhook is order_authorised — we already passed this step.
      if (eventType === 'order_approved') {
        try {
          await this.authoriseOrder(chargeId);
          this.logger.log(`Tamara order ${chargeId} authorised`);
        } catch (err) {
          this.logger.error(
            `Tamara authorise failed for ${chargeId}: ${(err as Error).message}`,
          );
          // DO NOT mark paid. Return 'pending' so the webhook controller's
          // "non-terminal status" branch skips the success flow entirely.
          // Tamara will retry the webhook on its own schedule.
          return {
            chargeId,
            status: 'pending',
            errorCode: 'authorise_failed',
            rawData: body,
          };
        }
      }

      // Step 2: Capture (also idempotent — Tamara returns the existing
      // capture record if we call it twice on the same order).
      try {
        await this.captureOrder(chargeId, Number(totalAmount), totalCurrency);
        this.logger.log(
          `Tamara order ${chargeId} captured for ${totalAmount} ${totalCurrency}`,
        );
      } catch (err) {
        this.logger.error(
          `Tamara capture failed for ${chargeId}: ${(err as Error).message}`,
        );
        return {
          chargeId,
          status: 'pending',
          errorCode: 'capture_failed',
          rawData: body,
        };
      }

      // Both steps succeeded. Now it's genuinely paid.
      return { chargeId, status: 'paid', rawData: body };
    }

    // Unknown event — log + return failed so it doesn't silently enroll
    // anyone. Tamara docs list ~10 events; any future additions show up here.
    this.logger.warn(
      `Tamara webhook with unhandled event_type=${eventType}, order=${chargeId}`,
    );
    return {
      chargeId,
      status: 'failed',
      errorCode: 'unknown_event',
      rawData: body,
    };
  }

  /**
   * Tell Tamara we (the merchant) confirm this order — moves it from
   * Approved → Authorised. Must be called within 72h of order_approved or
   * Tamara auto-cancels and refunds the buyer.
   *
   * Tamara docs: POST /orders/{order_id}/authorise
   */
  async authoriseOrder(orderId: string): Promise<void> {
    const response = await this.fetchWithRetry(
      `${this.apiUrl}/orders/${orderId}/authorise`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        // Tamara accepts an empty body for authorise.
        body: JSON.stringify({}),
      },
    );

    // 409 = already authorised. That's a SUCCESS for our purposes — we just
    // want the order in the authorised state, regardless of who got it there.
    if (response.status === 409) {
      this.logger.log(`Tamara order ${orderId} was already authorised (409)`);
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new PaymentGatewayError(
        'tamara',
        data.message || `Authorise failed with HTTP ${response.status}`,
        this.normalizeErrorCode(data.error_code || data.message),
        data,
      );
    }
  }

  /**
   * Tell Tamara to settle the funds to our merchant account. Must be called
   * after Authorise. Tamara holds an authorised-but-not-captured order for
   * ~30 days before auto-releasing.
   *
   * Tamara docs: POST /payments/capture
   */
  async captureOrder(
    orderId: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    const response = await this.fetchWithRetry(`${this.apiUrl}/payments/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: orderId,
        total_amount: { amount, currency },
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new PaymentGatewayError(
        'tamara',
        data.message || `Capture failed with HTTP ${response.status}`,
        this.normalizeErrorCode(data.error_code || data.message),
        data,
      );
    }
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    // Tamara's current documented refund endpoint is
    // `POST /payments/simplified-refund/{order_id}`. Body fields per their
    // public API reference (docs.tamara.co/reference/simplifiedrefund):
    //   total_amount       — required
    //   comment            — required; rejected as "comment is mandatory" if
    //                        omitted. (An older code comment here claimed it
    //                        was rejected as "unknown field" — that no
    //                        longer matches the live API; the docs win.)
    //   merchant_refund_id — optional; we pass our internal refund row id
    //                        so the same row is identifiable in Tamara's
    //                        merchant portal AND so a retry after a
    //                        timeout doesn't double-refund.
    // The order must already be in CAPTURED state, which our webhook handler
    // ensures by running authorise+capture inline on order_approved.
    const body: Record<string, unknown> = {
      total_amount: {
        amount: params.amount,
        currency: 'SAR',
      },
      // Mandatory per Tamara. Use the refund reason if present; otherwise a
      // neutral default that still satisfies the schema.
      comment: params.reason || 'Refund processed by merchant',
    };
    if (params.refundId) body.merchant_refund_id = params.refundId;

    const response = await this.fetchWithRetry(
      `${this.apiUrl}/payments/simplified-refund/${params.gatewayChargeId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      this.logger.error(`Tamara refund failed: ${JSON.stringify(data)}`);
      const code = this.normalizeErrorCode(data.error_code || data.message);
      throw new PaymentGatewayError(
        'tamara',
        data.message || 'Refund failed',
        code,
        data,
      );
    }

    return {
      refundId: data.refund_id || data.capture_id || params.gatewayChargeId,
      status: data.status || 'processing',
      rawResponse: data,
    };
  }

  async getCharge(chargeId: string): Promise<any> {
    const response = await this.fetchWithTimeout(`${this.apiUrl}/orders/${chargeId}`, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
    });

    return response.json();
  }

  async getPaymentStatus(chargeId: string): Promise<NormalizedPaymentStatus> {
    const data = await this.getCharge(chargeId);

    // Self-healing path for the verify endpoint. Tamara orders need the
    // merchant to actively call Authorise + Capture to settle — the webhook
    // handler does this inline on `order_approved`, but if Tamara's webhook
    // is delayed or lost (common in sandbox, occasionally in prod), the
    // payment would sit in 'pending' forever even though the buyer paid.
    //
    // Both Tamara endpoints are idempotent (Authorise: 409 on replay treated
    // as success; Capture: returns the existing capture record on replay), so
    // running them from verify is safe even if the webhook eventually arrives
    // and re-runs them.
    if (data.status === 'approved') {
      try {
        await this.authoriseOrder(chargeId);
        const totalAmount = Number(data.total_amount?.amount);
        const totalCurrency = data.total_amount?.currency || 'SAR';
        if (Number.isFinite(totalAmount) && totalAmount > 0) {
          await this.captureOrder(chargeId, totalAmount, totalCurrency);
          return 'paid';
        }
      } catch (err) {
        this.logger.warn(
          `Tamara verify-path settle failed for ${chargeId}: ${(err as Error).message} — staying pending, webhook will retry`,
        );
      }
    } else if (data.status === 'authorised') {
      // Authorise already done (probably by an earlier webhook attempt that
      // got as far as step 1) — just capture.
      try {
        const totalAmount = Number(data.total_amount?.amount);
        const totalCurrency = data.total_amount?.currency || 'SAR';
        if (Number.isFinite(totalAmount) && totalAmount > 0) {
          await this.captureOrder(chargeId, totalAmount, totalCurrency);
          return 'paid';
        }
      } catch (err) {
        this.logger.warn(
          `Tamara verify-path capture failed for ${chargeId}: ${(err as Error).message} — staying pending, webhook will retry`,
        );
      }
    }

    switch (data.status) {
      case 'captured':
      case 'fully_captured':
        return 'paid';
      case 'authorised':
      case 'approved':
      case 'pending_customer_action':
      case 'pending':
        return 'pending';
      case 'declined':
      case 'expired':
        return 'failed';
      case 'refunded':
      case 'fully_refunded':
        return 'refunded';
      case 'cancelled':
      case 'canceled':
        return 'cancelled';
      default:
        return 'unknown';
    }
  }

  async healthCheck(): Promise<GatewayHealthResult> {
    const start = Date.now();
    try {
      const res = await this.fetchWithTimeout(
        `${this.apiUrl}/payment-types?country=SA&currency=SAR&order_value=100`,
        { headers: { Authorization: `Bearer ${this.apiToken}` } },
        5000,
      );
      const latencyMs = Date.now() - start;
      return {
        gateway: 'tamara',
        status: res.ok ? 'healthy' : 'degraded',
        latencyMs,
        ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
        checkedAt: new Date(),
      };
    } catch (err: any) {
      return {
        gateway: 'tamara',
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
        label: 'Tamara — Pay in Installments',
        currencies: ['SAR', 'AED', 'KWD', 'BHD'],
        installmentOptions: this.getInstallmentOptions(100, 'SAR'),
      },
    ];
  }
}
