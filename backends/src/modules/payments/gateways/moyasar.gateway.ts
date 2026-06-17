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
        back_url: params.redirectUrl,
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

  processWebhook(body: any): WebhookResult {
    const chargeId = body.data?.id || body.id;
    let status: 'paid' | 'failed' | 'refunded' = 'failed';

    const eventType = body.type || body.status;
    if (eventType === 'payment_paid' || body.data?.status === 'paid') {
      status = 'paid';
    } else if (eventType === 'payment_refunded' || body.data?.status === 'refunded') {
      status = 'refunded';
    }

    return { chargeId, status, rawData: body };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const amountInHalalah = Math.round(params.amount * 100);

    const response = await this.fetchWithRetry(
      `${this.apiUrl}/payments/${params.gatewayChargeId}/refund`,
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
      refundId: data.id || params.gatewayChargeId,
      status: data.status || 'processing',
      rawResponse: data,
    };
  }

  async getCharge(chargeId: string): Promise<any> {
    const response = await this.fetchWithTimeout(`${this.apiUrl}/payments/${chargeId}`, {
      headers: {
        Authorization: this.getAuthHeader(),
      },
    });

    return response.json();
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
