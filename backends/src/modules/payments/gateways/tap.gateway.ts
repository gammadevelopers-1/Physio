import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
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
export class TapGateway extends BaseGateway implements PaymentGateway {
  readonly name = 'tap' as const;
  protected readonly logger = new Logger(TapGateway.name);
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.secretKey = this.configService.get<string>('payments.tap.secretKey', '');
    this.webhookSecret = this.configService.get<string>('payments.tap.webhookSecret', '');
    this.apiUrl = this.configService.get<string>('payments.tap.apiUrl', 'https://api.tap.company/v2');
  }

  private getTapSourceId(paymentMethod?: string): string {
    switch (paymentMethod) {
      case 'mada':      return 'src_sa.mada';
      case 'apple_pay': return 'src_apple_pay';
      case 'card':
      default:          return 'src_card';
    }
  }

  async createCharge(params: CreateChargeParams): Promise<ChargeResult> {
    const body = {
      amount: params.amount,
      currency: params.currency,
      customer_initiated: true,
      threeDSecure: true,
      save_card: false,
      description: params.description,
      metadata: params.metadata,
      receipt: { email: true, sms: false },
      customer: {
        first_name: params.customerName.split(' ')[0] || '',
        last_name: params.customerName.split(' ').slice(1).join(' ') || '',
        email: params.customerEmail,
        phone: params.customerPhone
          ? { country_code: '966', number: params.customerPhone }
          : undefined,
      },
      source: { id: this.getTapSourceId(params.paymentMethod) },
      redirect: { url: params.redirectUrl },
      post: { url: params.webhookUrl },
      language: params.locale === 'ar' ? 'ar' : 'en',
    };

    const response = await this.fetchWithRetry(`${this.apiUrl}/charges`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      this.logger.error(`Tap createCharge failed: ${JSON.stringify(data)}`);
      const code = this.normalizeErrorCode(data.errors?.[0]?.code || data.response?.code);
      throw new PaymentGatewayError(
        'tap',
        data.errors?.[0]?.description || 'Payment creation failed',
        code,
        data,
      );
    }

    return {
      chargeId: data.id,
      redirectUrl: data.transaction?.url || data.redirect?.url || '',
      status: data.status,
      rawResponse: data,
    };
  }

  verifyWebhook(headers: Record<string, string>, body: any): boolean {
    if (!this.webhookSecret) {
      this.logger.warn(
        'TAP_WEBHOOK_SECRET is not configured — all Tap webhooks will be rejected',
      );
      return false;
    }

    const receivedHash = headers['hashstring'] || headers['Hashstring'];
    if (!receivedHash) return false;

    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const expectedHash = createHmac('sha256', this.webhookSecret)
      .update(bodyStr)
      .digest('hex');

    return receivedHash === expectedHash;
  }

  processWebhook(body: any): WebhookResult {
    const chargeId = body.id || body.object?.id;
    const tapStatus = (body.status || '').toUpperCase();
    let status: WebhookResult['status'];

    switch (tapStatus) {
      case 'CAPTURED':
        status = 'paid';
        break;
      case 'REFUNDED':
        status = 'refunded';
        break;
      case 'FAILED':
      case 'DECLINED':
      case 'VOID':
      case 'CANCELLED':
        status = 'failed';
        break;
      case 'INITIATED':
      case 'IN_PROGRESS':
      case 'SAVED':
      default:
        // Non-terminal status — controller will skip processing
        status = 'pending';
        break;
    }

    let errorCode: string | undefined;
    if (status === 'failed') {
      const rawCode = body?.response?.code || body?.acquirer?.response?.code;
      if (rawCode) {
        errorCode = this.normalizeErrorCode(String(rawCode));
      }
    }

    return { chargeId, status, errorCode, rawData: body };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const body = {
      charge_id: params.gatewayChargeId,
      amount: params.amount,
      currency: 'SAR',
      reason: params.reason || 'Refund requested',
    };

    const response = await this.fetchWithRetry(`${this.apiUrl}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      this.logger.error(`Tap refund failed: ${JSON.stringify(data)}`);
      const code = this.normalizeErrorCode(data.errors?.[0]?.code);
      throw new PaymentGatewayError(
        'tap',
        data.errors?.[0]?.description || 'Refund failed',
        code,
        data,
      );
    }

    return {
      refundId: data.id,
      status: data.status?.toLowerCase() || 'processing',
      rawResponse: data,
    };
  }

  async getCharge(chargeId: string): Promise<any> {
    const response = await this.fetchWithTimeout(`${this.apiUrl}/charges/${chargeId}`, {
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      this.logger.error(`Tap getCharge failed for ${chargeId}: ${JSON.stringify(data)}`);
      const code = this.normalizeErrorCode(data.errors?.[0]?.code || data.response?.code);
      throw new PaymentGatewayError(
        'tap',
        data.errors?.[0]?.description || `Failed to fetch charge ${chargeId}`,
        code,
        data,
      );
    }

    return data;
  }

  async getPaymentStatus(chargeId: string): Promise<NormalizedPaymentStatus> {
    const data = await this.getCharge(chargeId);
    switch ((data.status || '').toUpperCase()) {
      case 'CAPTURED': return 'paid';
      case 'INITIATED': case 'IN_PROGRESS': return 'processing';
      case 'FAILED': case 'DECLINED': return 'failed';
      case 'REFUNDED': return 'refunded';
      case 'VOID': case 'CANCELLED': return 'cancelled';
      default: return 'unknown';
    }
  }

  async healthCheck(): Promise<GatewayHealthResult> {
    const start = Date.now();
    try {
      const res = await this.fetchWithTimeout(
        `${this.apiUrl}/charges?count=1`,
        { headers: { Authorization: `Bearer ${this.secretKey}` } },
        5000,
      );
      const latencyMs = Date.now() - start;
      // 401 = API reachable but key may be invalid in test env
      const ok = res.ok || res.status === 401;
      return {
        gateway: 'tap',
        status: ok ? 'healthy' : 'degraded',
        latencyMs,
        ...(ok ? {} : { error: `HTTP ${res.status}` }),
        checkedAt: new Date(),
      };
    } catch (err: any) {
      return {
        gateway: 'tap',
        status: 'down',
        latencyMs: Date.now() - start,
        error: err.message,
        checkedAt: new Date(),
      };
    }
  }

  getSupportedPaymentMethods(): SupportedPaymentMethod[] {
    return [
      { type: 'card',   label: 'Card via Tap', currencies: ['SAR', 'USD', 'AED', 'KWD', 'BHD', 'QAR', 'OMR'] },
      { type: 'card',   label: 'Mada',         currencies: ['SAR'] },
      { type: 'wallet', label: 'Apple Pay',    currencies: ['SAR', 'USD', 'AED'] },
    ];
  }
}
