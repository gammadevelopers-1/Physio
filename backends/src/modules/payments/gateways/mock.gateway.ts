import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
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

export type MockOutcome = 'success' | 'failure' | 'pending' | 'refunded';

export interface MockConfig {
  outcome: MockOutcome;
  /** Only meaningful when outcome='failure'. Maps to a NormalizedErrorCode. */
  errorCode?: string;
  /** Defaults to 'success'. Set to 'failure' to simulate gateway refund rejection. */
  refundOutcome?: 'success' | 'failure';
}

@Injectable()
export class MockGateway extends BaseGateway implements PaymentGateway {
  readonly name = 'mock' as const;
  protected readonly logger = new Logger(MockGateway.name);

  private config: MockConfig = { outcome: 'success', refundOutcome: 'success' };

  constructor(private readonly configService: ConfigService) {
    super();
  }

  configure(cfg: MockConfig): void {
    this.config = { refundOutcome: 'success', ...cfg };
    this.logger.log(`[MockGateway] Configured: ${JSON.stringify(this.config)}`);
  }

  setOutcome(o: MockOutcome): void {
    this.config = { outcome: o, refundOutcome: 'success' };
  }

  getOutcome(): MockOutcome {
    return this.config.outcome;
  }

  getConfig(): MockConfig {
    return { ...this.config };
  }

  async createCharge(params: CreateChargeParams): Promise<ChargeResult> {
    const chargeId = `mock_chg_${randomUUID()}`;
    const callbackUrl = this.configService.get<string>('payments.callbackUrl');

    this.logger.log(
      `[MockGateway] Creating charge ${chargeId} for ${params.amount} ${params.currency} ` +
      `(outcome: ${this.config.outcome}${this.config.errorCode ? `, errorCode: ${this.config.errorCode}` : ''})`,
    );

    // Refunded outcome: the initial payment goes through as 'paid' then a separate refund is done
    const callbackStatus = this.config.outcome === 'failure' ? 'failed'
      : this.config.outcome === 'pending' ? 'pending'
      : 'paid'; // 'success' and 'refunded' both start as paid

    const errorPart = (this.config.outcome === 'failure' && this.config.errorCode)
      ? `&error_code=${this.config.errorCode}`
      : '';

    const redirectUrl = `${callbackUrl}?gateway=mock&charge_id=${chargeId}&status=${callbackStatus}&payment_id=${params.metadata.paymentId}${errorPart}`;

    return {
      chargeId,
      redirectUrl,
      status: 'pending',
    };
  }

  verifyWebhook(_headers: Record<string, string>, _body: any): boolean {
    // Mock gateway always verifies
    return true;
  }

  async processWebhook(body: any): Promise<WebhookResult> {
    return {
      chargeId: body.charge_id || body.chargeId,
      status: body.status || 'paid',
    };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    this.logger.log(
      `[MockGateway] Refunding ${params.amount} for charge ${params.gatewayChargeId} (refundOutcome: ${this.config.refundOutcome})`,
    );

    if (this.config.refundOutcome === 'failure') {
      throw new PaymentGatewayError('mock', 'Refund declined (simulated failure)', 'gateway_error');
    }

    const refundId = `mock_ref_${randomUUID()}`;
    return { refundId, status: 'completed' };
  }

  async getCharge(chargeId: string): Promise<any> {
    this.logger.log(`[MockGateway] Getting charge ${chargeId}`);
    const statusMap: Record<MockOutcome, string> = {
      success: 'paid',
      failure: 'failed',
      pending: 'pending',
      refunded: 'refunded',
    };
    return {
      id: chargeId,
      status: statusMap[this.config.outcome] ?? 'unknown',
      amount: 0,
      currency: 'SAR',
    };
  }

  async getPaymentStatus(_chargeId: string): Promise<NormalizedPaymentStatus> {
    switch (this.config.outcome) {
      case 'success':  return 'paid';
      case 'failure':  return 'failed';
      case 'pending':  return 'pending';
      case 'refunded': return 'refunded';
      default:         return 'unknown';
    }
  }

  async healthCheck(): Promise<GatewayHealthResult> {
    return { gateway: 'mock', status: 'healthy', latencyMs: 0, checkedAt: new Date() };
  }

  getSupportedPaymentMethods(): SupportedPaymentMethod[] {
    return [{ type: 'card', label: 'Mock (Test Only)', currencies: ['SAR', 'USD'] }];
  }
}
