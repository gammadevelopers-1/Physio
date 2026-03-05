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

type MockOutcome = 'success' | 'failure' | 'pending';

@Injectable()
export class MockGateway extends BaseGateway implements PaymentGateway {
  readonly name = 'mock' as const;
  protected readonly logger = new Logger(MockGateway.name);

  private outcome: MockOutcome = 'success';

  constructor(private readonly configService: ConfigService) {
    super();
  }

  setOutcome(o: MockOutcome): void {
    this.outcome = o;
  }

  getOutcome(): MockOutcome {
    return this.outcome;
  }

  async createCharge(params: CreateChargeParams): Promise<ChargeResult> {
    const chargeId = `mock_chg_${randomUUID()}`;
    const callbackUrl = this.configService.get<string>('payments.callbackUrl');

    this.logger.log(
      `[MockGateway] Creating charge ${chargeId} for ${params.amount} ${params.currency} (outcome: ${this.outcome})`,
    );

    let status: string;
    if (this.outcome === 'failure') {
      status = 'failed';
    } else if (this.outcome === 'pending') {
      status = 'pending';
    } else {
      status = 'paid';
    }

    const redirectUrl = `${callbackUrl}?gateway=mock&charge_id=${chargeId}&status=${status}&payment_id=${params.metadata.paymentId}`;

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

  processWebhook(body: any): WebhookResult {
    return {
      chargeId: body.charge_id || body.chargeId,
      status: body.status || 'paid',
    };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const refundId = `mock_ref_${randomUUID()}`;

    this.logger.log(
      `[MockGateway] Refunding ${params.amount} for charge ${params.gatewayChargeId}`,
    );

    return {
      refundId,
      status: 'completed',
    };
  }

  async getCharge(chargeId: string): Promise<any> {
    this.logger.log(`[MockGateway] Getting charge ${chargeId}`);

    return {
      id: chargeId,
      status: this.outcome === 'success' ? 'paid' : this.outcome === 'failure' ? 'failed' : 'pending',
      amount: 0,
      currency: 'SAR',
    };
  }

  async getPaymentStatus(_chargeId: string): Promise<NormalizedPaymentStatus> {
    return this.outcome === 'success' ? 'paid' : this.outcome === 'failure' ? 'failed' : 'pending';
  }

  async healthCheck(): Promise<GatewayHealthResult> {
    return { gateway: 'mock', status: 'healthy', latencyMs: 0, checkedAt: new Date() };
  }

  getSupportedPaymentMethods(): SupportedPaymentMethod[] {
    return [{ type: 'card', label: 'Mock (Test Only)', currencies: ['SAR', 'USD'] }];
  }
}
