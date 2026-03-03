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
} from './payment-gateway.interface';

@Injectable()
export class TapGateway implements PaymentGateway {
  readonly name = 'tap' as const;
  private readonly logger = new Logger(TapGateway.name);
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('payments.tap.secretKey', '');
    this.webhookSecret = this.configService.get<string>('payments.tap.webhookSecret', '');
    this.apiUrl = this.configService.get<string>('payments.tap.apiUrl', 'https://api.tap.company/v2');
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
      source: { id: 'src_card' },
      redirect: { url: params.redirectUrl },
      post: { url: params.webhookUrl },
    };

    const response = await fetch(`${this.apiUrl}/charges`, {
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
      throw new Error(`Tap payment creation failed: ${data.errors?.[0]?.description || 'Unknown error'}`);
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
    let status: 'paid' | 'failed' | 'refunded' = 'failed';

    if (body.status === 'CAPTURED' || body.status === 'captured') {
      status = 'paid';
    } else if (body.status === 'REFUNDED' || body.status === 'refunded') {
      status = 'refunded';
    }

    return { chargeId, status, rawData: body };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const body = {
      charge_id: params.gatewayChargeId,
      amount: params.amount,
      currency: 'SAR',
      reason: params.reason || 'Refund requested',
    };

    const response = await fetch(`${this.apiUrl}/refunds`, {
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
      throw new Error(`Tap refund failed: ${data.errors?.[0]?.description || 'Unknown error'}`);
    }

    return {
      refundId: data.id,
      status: data.status?.toLowerCase() || 'processing',
      rawResponse: data,
    };
  }

  async getCharge(chargeId: string): Promise<any> {
    const response = await fetch(`${this.apiUrl}/charges/${chargeId}`, {
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
      },
    });

    return response.json();
  }
}
