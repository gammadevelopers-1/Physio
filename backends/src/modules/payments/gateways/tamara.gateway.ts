import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../../../database';
import { payments } from '../../../database/schema';
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
    const firstName = params.customerName.split(' ')[0] || '';
    const lastName = params.customerName.split(' ').slice(1).join(' ') || '';

    // Tamara wants dd-mm-yyyy; we receive ISO YYYY-MM-DD (or full ISO
    // timestamp). Slice + reorder. Returns undefined on empty input so we
    // can spread-omit the field cleanly.
    const toDdMmYyyy = (isoOrDate: string | undefined): string | undefined => {
      if (!isoOrDate) return undefined;
      const iso = isoOrDate.slice(0, 10); // "2026-07-06"
      const [y, m, d] = iso.split('-');
      return y && m && d ? `${d}-${m}-${y}` : undefined;
    };

    // Whether this is the buyer's first successful purchase on the platform.
    // Buyer history isn't populated for non-BNPL gateways, but it always is
    // for Tamara (see payments.service.ts's `dto.gateway === 'tamara'` branch).
    const isFirstOrder =
      !params.buyerHistory || params.buyerHistory.loyaltyLevel === 0;

    // Course window for the education object. Fall back to (today,
    // today + monthsToCompletion) when the caller couldn't provide dates
    // (self-paced / open-ended courses). Tamara rejects the checkout if
    // education fields are missing for merchants onboarded under the
    // educational-services vertical — see docs.tamara.co/docs/other-educational-services.
    const monthsToCompletion = params.educationDetails?.monthsToCompletion ?? 1;
    const courseStartIso =
      params.educationDetails?.courseStartDate ??
      new Date().toISOString().slice(0, 10);
    const courseEndIso =
      params.educationDetails?.courseEndDate ??
      (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + monthsToCompletion);
        return d.toISOString().slice(0, 10);
      })();

    // Risk-assessment snapshot Tamara feeds into their eligibility model.
    // Without a populated risk_assessment object Tamara can't score the
    // buyer and defaults to the most conservative outcome — all installment
    // plans locked, only Pay-in-Full offered. Fields are per Tamara's
    // additional-customer-details-for-risk-assessment doc; dates in dd-mm-yyyy.
    const past = params.buyerHistory?.pastOrders ?? [];
    const paidOrders = past.filter((o) => o.status === 'complete');
    const registeredSinceDate = params.customerRegisteredSince
      ? new Date(params.customerRegisteredSince).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const firstPaidDate = paidOrders.length
      ? paidOrders[paidOrders.length - 1].purchasedAt.slice(0, 10)
      : undefined;
    const lastPaidDate = paidOrders.length
      ? paidOrders[0].purchasedAt.slice(0, 10)
      : undefined;

    const body: Record<string, unknown> = {
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
      // Deliberately NO `payment_type` and NO top-level `instalments`.
      // Sending `payment_type: 'PAY_BY_INSTALMENTS'` with `instalments: 3`
      // pinned the buyer to a 3-month plan and Tamara locked every other
      // installment option (verified against their live /checkout/payment-types
      // which shows our merchant has 2, 3, AND 4 all enabled). Omitting both
      // lets Tamara render every eligible plan on their hosted checkout.
      locale: params.locale || 'en_US',
      // "One Time - Digital" is Tamara's expected item.type for
      // educational-services merchants selling one-off course access. Their
      // legacy generic "Digital" value gets scored more conservatively.
      items: [
        {
          reference_id: params.metadata.courseId,
          type: 'One Time - Digital',
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
        first_name: firstName,
        last_name: lastName,
        email: params.customerEmail,
        phone_number: params.customerPhone || '',
        // Tamara REQUIRES national_id on the consumer for KSA merchants —
        // it's how they run SIMAH credit checks. Omitting causes every
        // installment plan to lock at their hosted checkout, only Pay-in-Full
        // remains. Send when we have it; Tamara returns a clear 400 if we
        // don't and the merchant is set up to require it.
        ...(params.customerNationalId
          ? { national_id: params.customerNationalId }
          : {}),
        // Optional but improves scoring. Tamara expects dd-mm-yyyy.
        ...(params.customerDateOfBirth
          ? { date_of_birth: toDdMmYyyy(params.customerDateOfBirth) }
          : {}),
        is_first_order: isFirstOrder,
      },
      shipping_address: {
        first_name: firstName,
        last_name: lastName,
        country_code: 'SA',
        city: 'Riyadh',
        line1: 'Digital Delivery',
      },
      // Educational-services vertical: Tamara requires the education
      // object with these four fields (education_type, start_date,
      // end_date, event_location). See
      // docs.tamara.co/docs/other-educational-services.
      education: {
        education_type: 'course',
        start_date: toDdMmYyyy(courseStartIso),
        end_date: toDdMmYyyy(courseEndIso),
        event_location: 'online',
      },
      // Risk assessment: merchant-side eligibility signal. All 5 core
      // fields required; account_security is optional but helps scoring.
      risk_assessment: {
        is_premium_customer: false,
        account_creation_date: toDdMmYyyy(registeredSinceDate),
        total_order_count: past.length,
        // For first-time buyers Tamara accepts the same date as
        // account_creation_date rather than a hard null.
        date_first_paid: firstPaidDate
          ? toDdMmYyyy(firstPaidDate)
          : toDdMmYyyy(registeredSinceDate),
        date_last_paid: lastPaidDate
          ? toDdMmYyyy(lastPaidDate)
          : toDdMmYyyy(registeredSinceDate),
        account_security: {
          is_email_verified: true,
          is_phone_verified: Boolean(params.customerPhone),
        },
      },
      // Identifies our integration in Tamara's merchant portal logs.
      platform: 'PhysioGuidance/NestJS',
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

    // Redacted-payload log for post-checkout eligibility debugging. When
    // Tamara locks all installment plans at their hosted page it's opaque
    // whether the merchant score, the buyer profile, or an order-shape
    // mismatch is the cause — surfacing the exact body we sent (with PII
    // masked) is the only way to hand this back to Tamara's tech team with
    // evidence instead of guessing.
    const consumer = body.consumer as Record<string, unknown>;
    const redactedBody = {
      ...body,
      consumer: {
        ...consumer,
        email: typeof consumer.email === 'string' ? consumer.email.replace(/(.{2}).+(@.+)/, '$1***$2') : consumer.email,
        phone_number: typeof consumer.phone_number === 'string' && consumer.phone_number.length > 4
          ? `${consumer.phone_number.slice(0, 4)}***${consumer.phone_number.slice(-2)}`
          : consumer.phone_number,
        national_id: consumer.national_id ? '***REDACTED***' : undefined,
      },
    };
    this.logger.log(`Tamara createCharge outbound body: ${JSON.stringify(redactedBody)}`);

    const response = await this.fetchWithRetry(`${this.apiUrl}/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    this.logger.log(`Tamara createCharge response status=${response.status} order_id=${data.order_id || 'n/a'} body=${JSON.stringify(data)}`);

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

  /**
   * Verify Tamara's webhook signature.
   *
   * Tamara signs every webhook as a JWT (HS256) using the Notification Token
   * provisioned per-merchant. Per Tamara's docs the token is attached in two
   * places:
   *   - Query parameter: `?tamaraToken=<jwt>`
   *   - Authorization header: `Authorization: Bearer <jwt>`
   * We accept both. `jsonwebtoken.verify` validates the signature, algorithm,
   * and `exp` claim; we additionally require `iss === "Tamara"` to reject any
   * accidentally-forwarded token from another issuer.
   */
  verifyWebhook(headers: Record<string, string>, _body: any): boolean {
    if (!this.notificationToken) return false;

    const token = this.extractTamaraToken(headers);
    if (!token) return false;

    try {
      const payload = jwt.verify(token, this.notificationToken, {
        algorithms: ['HS256'],
      });
      if (typeof payload !== 'object' || payload === null) return false;
      const iss = (payload as jwt.JwtPayload).iss;
      // Tamara's own example payload sets iss="Tamara" — reject anything else
      // to prevent a stray token from another Tamara-related service passing.
      if (iss && iss !== 'Tamara') return false;
      return true;
    } catch {
      // Signature mismatch, expired, malformed — treat all as invalid.
      return false;
    }
  }

  /** Pull the JWT from Authorization: Bearer first, then fall back to a
   *  ?tamaraToken= query param that some gateways surface in a header for us. */
  private extractTamaraToken(
    headers: Record<string, string>,
  ): string | null {
    const auth = headers['authorization'] || headers['Authorization'];
    if (typeof auth === 'string') {
      const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
      if (match) return match[1].trim();
    }
    // Some proxies pass the raw query string through as a header we can
    // access; NestJS's @Query is not routed to verifyWebhook, so a
    // dedicated header fallback keeps the signature stable.
    const q = headers['x-tamara-token'] || headers['X-Tamara-Token'];
    if (typeof q === 'string' && q.length > 0) return q;
    return null;
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
      if (!chargeId) {
        this.logger.error(
          `Tamara ${eventType} webhook missing order_id: ${JSON.stringify(body)}`,
        );
        return { chargeId, status: 'failed', errorCode: 'malformed_webhook', rawData: body };
      }
      // Tamara's order_approved webhook does not always echo total_amount
      // in the payload (observed: {"order_id":"...","event_type":"order_approved","data":[]}).
      // We're authoritative on the amount anyway — read it from our own
      // payment record, keyed by the gateway_charge_id we stored when the
      // order was created. Falling back to the webhook made us fail the
      // capture step whenever Tamara omitted the amount field.
      const [paymentRow] = await db
        .select({ amount: payments.amount, currency: payments.currency })
        .from(payments)
        .where(eq(payments.gatewayChargeId, chargeId))
        .limit(1);
      if (!paymentRow) {
        this.logger.error(
          `Tamara ${eventType} webhook for unknown order ${chargeId} — no payment row`,
        );
        return { chargeId, status: 'failed', errorCode: 'unknown_charge', rawData: body };
      }
      const totalAmount = Number(paymentRow.amount);
      const totalCurrency = paymentRow.currency || 'SAR';
      if (!(totalAmount > 0)) {
        this.logger.error(
          `Tamara ${eventType} webhook for order ${chargeId} but payment amount is ${paymentRow.amount}`,
        );
        return { chargeId, status: 'failed', errorCode: 'invalid_amount', rawData: body };
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

  /**
   * Merchant-initiated cancellation. Kills a Tamara order that is still in
   * a pre-capture state (Approved or Authorised) so the buyer is released
   * from the instalment plan and any authorised hold is voided.
   *
   * Docs: POST /orders/{order_id}/cancel — accepts `total_amount` (required,
   * must match the original order total) and an optional `comment` for the
   * merchant portal. We pass our internal `cancelId` (paymentId + timestamp
   * salt is unnecessary: paymentId is enough because cancel is a one-shot
   * per order) so a retried call after a network blip is idempotent.
   *
   * Do NOT call this on captured orders — Tamara will refuse; use `refund()`
   * once money has settled. The caller is expected to enforce that gate
   * via the payment status check.
   */
  async cancelOrder(
    orderId: string,
    params: { amount: number; currency: string; comment?: string; cancelId?: string },
  ): Promise<{ status: string; rawResponse: any }> {
    const body: Record<string, unknown> = {
      total_amount: { amount: params.amount, currency: params.currency },
    };
    if (params.comment) body.comment = params.comment;
    if (params.cancelId) body.cancel_id = params.cancelId;

    const response = await this.fetchWithRetry(
      `${this.apiUrl}/orders/${orderId}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json().catch(() => ({}));

    // 409 = already cancelled. Treat as success — the caller wanted the
    // order in the cancelled state, and it's there.
    if (response.status === 409) {
      this.logger.log(`Tamara order ${orderId} was already cancelled (409)`);
      return { status: 'cancelled', rawResponse: data };
    }

    if (!response.ok) {
      this.logger.error(`Tamara cancelOrder failed: ${JSON.stringify(data)}`);
      throw new PaymentGatewayError(
        'tamara',
        data.message || `Cancel failed with HTTP ${response.status}`,
        this.normalizeErrorCode(data.error_code || data.message),
        data,
      );
    }

    return {
      status: data.status || 'cancelled',
      rawResponse: data,
    };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    // Tamara's current documented refund endpoint is
    // `POST /payments/simplified-refund/{order_id}`. Body fields per their
    // public API reference (docs.tamara.co/reference/simplifiedrefund):
    //   total_amount       — required. Partial refunds work natively: send
    //                        a smaller amount than the original payment and
    //                        Tamara returns status: "partially_refunded".
    //                        Remaining installments stay open with Tamara
    //                        on the customer side.
    //   comment            — required; rejected as "comment is mandatory" if
    //                        omitted. (An older code comment here claimed it
    //                        was rejected as "unknown field" — that no
    //                        longer matches the live API; the docs win.)
    //   merchant_refund_id — optional; we pass our internal refund row id
    //                        so the same row is identifiable in Tamara's
    //                        merchant portal AND so a retry after a
    //                        timeout doesn't double-refund.
    // params.items is ignored — Tamara has no per-line breakdown field on
    // simplified-refund (only the bulk capture-and-refund endpoint does).
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
      // Correct endpoint is `/checkout/payment-types` — the old
      // `/payment-types` returns 404 and had our health check
      // permanently reporting `degraded`.
      const res = await this.fetchWithTimeout(
        `${this.apiUrl}/checkout/payment-types?country=SA&currency=SAR&order_value=100`,
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
