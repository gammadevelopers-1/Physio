import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentGateway,
  CreateChargeParams,
  ChargeResult,
  RefundParams,
  RefundResult,
  WebhookResult,
  GatewayHealthResult,
  NormalizedPaymentStatus,
  SupportedPaymentMethod,
} from './payment-gateway.interface';
import { BaseGateway } from './base.gateway';
import { PaymentGatewayError } from './payment-gateway.error';

@Injectable()
export class MoyasarGateway extends BaseGateway implements PaymentGateway {
  readonly name = 'moyasar' as const;
  protected readonly logger = new Logger(MoyasarGateway.name);
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.secretKey = this.configService.get<string>('payments.moyasar.secretKey', '');
    this.webhookSecret = this.configService.get<string>('payments.moyasar.webhookSecret', '');
    this.apiUrl = this.configService.get<string>('payments.moyasar.apiUrl', 'https://api.moyasar.com/v1');
  }

  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.secretKey}:`).toString('base64');
  }

  async createCharge(params: CreateChargeParams): Promise<ChargeResult> {
    // Moyasar uses amount in halalah (smallest currency unit)
    const amountInHalalah = Math.round(params.amount * 100);

    const response = await this.fetchWithRetry(`${this.apiUrl}/invoices`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInHalalah,
        currency: params.currency,
        description: params.description,
        // callback_url is Moyasar's server-side notification target. To redirect
        // the buyer's BROWSER back to our app after payment, Moyasar invoices use
        // success_url (on success) and back_url (on cancel/back) — without these
        // the customer is stranded on Moyasar's hosted "Invoice Paid" page.
        callback_url: params.redirectUrl,
        success_url: params.redirectUrl,
        // "Back"/cancel returns the buyer to checkout, not the processing page.
        back_url: params.cancelUrl || params.redirectUrl,
        metadata: params.metadata,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      this.logger.error(`Moyasar createCharge failed: ${JSON.stringify(data)}`);
      const code = this.normalizeErrorCode(data.type || data.message);
      throw new PaymentGatewayError(
        'moyasar',
        data.message || 'Payment creation failed',
        code,
        data,
      );
    }

    return {
      chargeId: data.id,
      redirectUrl: data.url || '',
      status: data.status || 'created',
      rawResponse: data,
    };
  }

  verifyWebhook(headers: Record<string, string>, body: any): boolean {
    if (!this.webhookSecret) {
      this.logger.warn(
        'MOYASAR_WEBHOOK_SECRET is not configured — all Moyasar webhooks will be rejected',
      );
      return false;
    }

    // Moyasar uses a shared secret token in the payload
    const token = body?.secret_token || body?.token;
    return token === this.webhookSecret;
  }

  async processWebhook(body: any): Promise<WebhookResult> {
    // We key payments by the Moyasar INVOICE id (stored as gatewayChargeId).
    // A payment webhook references its invoice via data.invoice_id; fall back to
    // data.id for non-invoice events.
    const chargeId = body.data?.invoice_id || body.data?.id || body.id;
    let status: 'paid' | 'failed' | 'refunded' | 'chargeback' = 'failed';

    const eventType = body.type || body.status;
    // Chargeback detection: Moyasar may emit a dedicated `payment_chargeback`
    // event, or surface a chargeback via a refund event whose reason/source
    // indicates a dispute (e.g. `chargeback`, `dispute`). Be lenient — we
    // log everything and the finance dashboard surfaces the raw payload so
    // mis-detections can be corrected manually if Moyasar's shape changes.
    const refundReason: string | undefined =
      body.data?.refunded_reason || body.data?.refund_reason || body.data?.source;
    const isChargebackSignal =
      eventType === 'payment_chargeback' ||
      body.data?.status === 'chargeback' ||
      (typeof refundReason === 'string' && /chargeback|dispute/i.test(refundReason));

    if (isChargebackSignal) {
      status = 'chargeback';
    } else if (eventType === 'payment_paid' || body.data?.status === 'paid') {
      status = 'paid';
    } else if (eventType === 'payment_refunded' || body.data?.status === 'refunded') {
      status = 'refunded';
    }

    return { chargeId, status, rawData: body };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    // `gatewayChargeId` is a Moyasar INVOICE id (we use POST /invoices, not
    // /payments). Refunds, however, must target the underlying PAYMENT id —
    // the previous version hit /payments/{invoiceId}/refund and got back
    // "Payment record not found". Fetch the invoice, pick the successful
    // payment from invoice.payments[], then refund that.
    const invoiceResp = await this.fetchWithTimeout(
      `${this.apiUrl}/invoices/${params.gatewayChargeId}`,
      { headers: { Authorization: this.getAuthHeader() } },
    );
    const invoiceData = await invoiceResp.json();
    if (!invoiceResp.ok) {
      this.logger.error(
        `Moyasar invoice lookup failed for refund: ${JSON.stringify(invoiceData)}`,
      );
      throw new PaymentGatewayError(
        'moyasar',
        invoiceData.message || `Invoice ${params.gatewayChargeId} not found`,
        this.normalizeErrorCode(invoiceData.type || invoiceData.message),
        invoiceData,
      );
    }
    const paidPayment = (invoiceData.payments || []).find(
      (p: { id: string; status: string }) =>
        p.status === 'paid' || p.status === 'captured',
    );
    if (!paidPayment?.id) {
      throw new PaymentGatewayError(
        'moyasar',
        `No paid payment found under invoice ${params.gatewayChargeId}`,
        'unknown',
        invoiceData,
      );
    }

    const amountInHalalah = Math.round(params.amount * 100);
    const response = await this.fetchWithRetry(
      `${this.apiUrl}/payments/${paidPayment.id}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: amountInHalalah }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      this.logger.error(`Moyasar refund failed: ${JSON.stringify(data)}`);
      const code = this.normalizeErrorCode(data.type || data.message);
      throw new PaymentGatewayError(
        'moyasar',
        data.message || 'Refund failed',
        code,
        data,
      );
    }

    return {
      refundId: data.id || paidPayment.id,
      status: data.status || 'processing',
      rawResponse: data,
    };
  }

  async getCharge(chargeId: string): Promise<any> {
    // gatewayChargeId is a Moyasar INVOICE id (we create invoices), so query the
    // invoice endpoint — GET /payments/{id} would 404 with an invoice id. The
    // invoice carries a `status` of 'paid' once settled.
    const response = await this.fetchWithTimeout(`${this.apiUrl}/invoices/${chargeId}`, {
      headers: {
        Authorization: this.getAuthHeader(),
      },
    });

    return response.json();
  }

  /**
   * Paginated list of invoices in a date range. Used by the reconciliation
   * scan to compare Moyasar's own records against our payments table. Returns
   * a slice; caller is responsible for paginating until `meta.next_page` is null.
   *
   * Moyasar uses cursor-style pagination via `?page=N&per_page=M`. Dates filter
   * via `created[gte]` / `created[lte]` in ISO-8601.
   */
  async listInvoices(opts: {
    fromIso: string;
    toIso: string;
    page?: number;
    perPage?: number;
  }): Promise<{
    invoices: Array<{
      id: string;
      status: string;
      amount: number;
      currency: string;
      created_at: string;
      metadata: Record<string, unknown> | null;
    }>;
    meta: { current_page: number; next_page: number | null; total_count: number };
  }> {
    const sp = new URLSearchParams({
      'created[gte]': opts.fromIso,
      'created[lte]': opts.toIso,
      page: String(opts.page ?? 1),
      per_page: String(opts.perPage ?? 100),
    });

    const response = await this.fetchWithTimeout(
      `${this.apiUrl}/invoices?${sp.toString()}`,
      { headers: { Authorization: this.getAuthHeader() } },
      15000,
    );
    if (!response.ok) {
      throw new Error(`Moyasar listInvoices failed: HTTP ${response.status}`);
    }
    const data = (await response.json()) as any;
    return {
      invoices: data.invoices || [],
      meta: data.meta || { current_page: opts.page ?? 1, next_page: null, total_count: 0 },
    };
  }

  async getPaymentStatus(chargeId: string): Promise<NormalizedPaymentStatus> {
    const data = await this.getCharge(chargeId);
    switch (data.status) {
      case 'paid': case 'captured': return 'paid';
      case 'pending': case 'initiated': return 'pending';
      case 'failed': return 'failed';
      case 'refunded': return 'refunded';
      default: return 'unknown';
    }
  }

  async healthCheck(): Promise<GatewayHealthResult> {
    const start = Date.now();
    try {
      const res = await this.fetchWithTimeout(
        `${this.apiUrl}/payments?per_page=1`,
        { headers: { Authorization: this.getAuthHeader() } },
        5000,
      );
      const latencyMs = Date.now() - start;
      // 401 = API reachable but key may be invalid in test env
      const ok = res.ok || res.status === 401;
      return {
        gateway: 'moyasar',
        status: ok ? 'healthy' : 'degraded',
        latencyMs,
        ...(ok ? {} : { error: `HTTP ${res.status}` }),
        checkedAt: new Date(),
      };
    } catch (err: any) {
      return {
        gateway: 'moyasar',
        status: 'down',
        latencyMs: Date.now() - start,
        error: err.message,
        checkedAt: new Date(),
      };
    }
  }

  getSupportedPaymentMethods(): SupportedPaymentMethod[] {
    return [
      { type: 'card', label: 'Card via Moyasar', currencies: ['SAR'] },
    ];
  }
}
