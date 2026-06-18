import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
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
export class TabbyGateway extends BaseGateway implements BnplPaymentGateway {
  readonly name = 'tabby' as const;
  readonly isBnpl = true as const;
  readonly deductionRate = 0.10;
  protected readonly logger = new Logger(TabbyGateway.name);
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly webhookSecret: string;
  private readonly apiUrl: string;
  private readonly merchantCode: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.secretKey = this.configService.get<string>('payments.tabby.secretKey', '');
    this.publicKey = this.configService.get<string>('payments.tabby.publicKey', '');
    this.webhookSecret = this.configService.get<string>('payments.tabby.webhookSecret', '');
    this.apiUrl = this.configService.get<string>('payments.tabby.apiUrl', 'https://api.tabby.ai/api/v2');
    this.merchantCode = this.configService.get<string>('payments.tabby.merchantCode', '');
  }

  getInstallmentOptions(amount: number, currency: string): InstallmentOption[] {
    return [
      { installments: 4, monthlyAmount: +(amount / 4).toFixed(2), totalAmount: amount, currency },
    ];
  }

  async createCharge(params: CreateChargeParams): Promise<ChargeResult> {
    if (!this.merchantCode) {
      throw new PaymentGatewayError(
        'tabby',
        'TABBY_MERCHANT_CODE is not configured',
        'gateway_error',
      );
    }

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
        // Real registration timestamp feeds Tabby's risk model; passing
        // "now" (the old default) made every buyer look brand-new and
        // hurt approvals for established customers.
        buyer_history: {
          registered_since:
            params.customerRegisteredSince || new Date().toISOString(),
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

    // Tabby's docs name the header X-Tabby-Signature. The legacy
    // X-Tabby-Hmac-SHA256 fallback covers older portal configurations
    // some merchants still have. Headers come through Express lower-cased
    // so check both casings to be safe.
    const signature =
      headers['x-tabby-signature'] ||
      headers['X-Tabby-Signature'] ||
      headers['x-tabby-hmac-sha256'] ||
      headers['X-Tabby-Hmac-SHA256'];
    if (!signature) return false;

    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const expectedSignature = createHmac('sha256', this.webhookSecret)
      .update(bodyStr)
      .digest('hex');

    return signature === expectedSignature;
  }

  async processWebhook(body: any): Promise<WebhookResult> {
    const chargeId = body.id || body.payment?.id;
    const status = (body.status || '').toUpperCase();

    // Successful outcomes
    if (status === 'AUTHORIZED' || status === 'CLOSED') {
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

  async refund(params: RefundParams): Promise<RefundResult> {
    const body = {
      amount: params.amount.toFixed(2),
    };

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
      this.logger.error(`Tabby refund failed: ${JSON.stringify(data)}`);
      const code = this.normalizeErrorCode(data.error || data.message);
      throw new PaymentGatewayError(
        'tabby',
        data.error || 'Refund failed',
        code,
        data,
      );
    }

    return {
      refundId: data.id || params.gatewayChargeId,
      status: data.status?.toLowerCase() || 'processing',
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
