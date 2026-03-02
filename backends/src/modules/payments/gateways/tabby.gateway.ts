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
export class TabbyGateway implements PaymentGateway {
  readonly name = 'tabby' as const;
  private readonly logger = new Logger(TabbyGateway.name);
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly webhookSecret: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.secretKey = this.configService.get<string>('payments.tabby.secretKey', '');
    this.publicKey = this.configService.get<string>('payments.tabby.publicKey', '');
    this.webhookSecret = this.configService.get<string>('payments.tabby.webhookSecret', '');
    this.apiUrl = this.configService.get<string>('payments.tabby.apiUrl', 'https://api.tabby.ai/api/v2');
  }

  async createCharge(params: CreateChargeParams): Promise<ChargeResult> {
    const body = {
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
              quantity: 1,
              unit_price: params.amount.toFixed(2),
              category: 'Education',
            },
          ],
        },
        buyer_history: {
          registered_since: new Date().toISOString(),
          loyalty_level: 0,
        },
        shipping_address: {
          city: 'Riyadh',
          address: 'Digital Delivery',
          zip: '11111',
        },
        meta: params.metadata,
      },
      lang: params.locale || 'en',
      merchant_code: 'physioguidance',
      merchant_urls: {
        success: params.redirectUrl,
        cancel: params.redirectUrl.replace('status=paid', 'status=cancelled'),
        failure: params.redirectUrl.replace('status=paid', 'status=failed'),
      },
    };

    const response = await fetch(`${this.apiUrl}/checkout`, {
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
      throw new Error(`Tabby checkout creation failed: ${data.error || 'Unknown error'}`);
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
    if (!this.webhookSecret) return false;

    const signature =
      headers['x-tabby-hmac-sha256'] || headers['X-Tabby-Hmac-SHA256'];
    if (!signature) return false;

    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const expectedSignature = createHmac('sha256', this.webhookSecret)
      .update(bodyStr)
      .digest('hex');

    return signature === expectedSignature;
  }

  processWebhook(body: any): WebhookResult {
    const chargeId = body.id || body.payment?.id;
    let status: 'paid' | 'failed' | 'refunded' = 'failed';

    if (body.status === 'AUTHORIZED' || body.status === 'CLOSED') {
      status = 'paid';
    } else if (body.status === 'REFUNDED') {
      status = 'refunded';
    }

    return { chargeId, status, rawData: body };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const body = {
      amount: params.amount.toFixed(2),
    };

    const response = await fetch(
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
      this.logger.error(`Tabby refund failed: ${JSON.stringify(data)}`);
      throw new Error(`Tabby refund failed: ${data.error || 'Unknown error'}`);
    }

    return {
      refundId: data.id || params.gatewayChargeId,
      status: 'processing',
      rawResponse: data,
    };
  }

  async getCharge(chargeId: string): Promise<any> {
    const response = await fetch(`${this.apiUrl}/payments/${chargeId}`, {
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
      },
    });

    return response.json();
  }
}
