import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentGateway,
  CreateChargeParams,
  ChargeResult,
  RefundParams,
  RefundResult,
  WebhookResult,
} from './payment-gateway.interface';

@Injectable()
export class MoyasarGateway implements PaymentGateway {
  readonly name = 'moyasar' as const;
  private readonly logger = new Logger(MoyasarGateway.name);
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
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

    const body = {
      amount: amountInHalalah,
      currency: params.currency,
      description: params.description,
      callback_url: params.redirectUrl,
      metadata: params.metadata,
      source: {
        type: 'creditcard',
        name: params.customerName,
        // Card details are collected on Moyasar's hosted page
      },
    };

    const response = await fetch(`${this.apiUrl}/invoices`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInHalalah,
        currency: params.currency,
        description: params.description,
        callback_url: params.redirectUrl,
        metadata: params.metadata,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      this.logger.error(`Moyasar createCharge failed: ${JSON.stringify(data)}`);
      throw new Error(`Moyasar payment creation failed: ${data.message || 'Unknown error'}`);
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

    const response = await fetch(
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
      throw new Error(`Moyasar refund failed: ${data.message || 'Unknown error'}`);
    }

    return {
      refundId: data.id || params.gatewayChargeId,
      status: data.status || 'processing',
      rawResponse: data,
    };
  }

  async getCharge(chargeId: string): Promise<any> {
    const response = await fetch(`${this.apiUrl}/payments/${chargeId}`, {
      headers: {
        Authorization: this.getAuthHeader(),
      },
    });

    return response.json();
  }
}
