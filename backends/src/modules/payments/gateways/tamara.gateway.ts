import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

@Injectable()
export class TamaraGateway extends BaseGateway implements BnplPaymentGateway {
  readonly name = 'tamara' as const;
  readonly isBnpl = true as const;
  readonly deductionRate = 0.10;
  protected readonly logger = new Logger(TamaraGateway.name);
  private readonly apiToken: string;
  private readonly notificationToken: string;
  private readonly apiUrl: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.apiToken = this.configService.get<string>('payments.tamara.apiToken', '');
    this.notificationToken = this.configService.get<string>('payments.tamara.notificationToken', '');
    this.apiUrl = this.configService.get<string>('payments.tamara.apiUrl', 'https://api-sandbox.tamara.co');
  }

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
      merchant_url: {
        success: params.redirectUrl,
        failure: params.redirectUrl.replace('status=paid', 'status=failed'),
        cancel: params.redirectUrl.replace('status=paid', 'status=cancelled'),
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

    const token =
      headers['notification-token'] || headers['Notification-Token'];
    return token === this.notificationToken;
  }

  processWebhook(body: any): WebhookResult {
    const chargeId = body.order_id || body.data?.order_id;
    let status: 'paid' | 'failed' | 'refunded' = 'failed';

    const eventType = body.event_type || body.type;
    if (
      eventType === 'order_approved' ||
      eventType === 'order_captured'
    ) {
      status = 'paid';
    } else if (eventType === 'order_refunded') {
      status = 'refunded';
    }

    return { chargeId, status, rawData: body };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const body = {
      total_amount: {
        amount: params.amount,
        currency: 'SAR',
      },
      comment: params.reason || 'Refund requested',
    };

    const response = await this.fetchWithRetry(
      `${this.apiUrl}/orders/${params.gatewayChargeId}/refund`,
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
    switch (data.status) {
      case 'approved': case 'captured': case 'fully_captured': return 'paid';
      case 'pending_customer_action': case 'pending': return 'pending';
      case 'declined': case 'expired': return 'failed';
      case 'refunded': case 'fully_refunded': return 'refunded';
      case 'cancelled': return 'cancelled';
      default: return 'unknown';
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
