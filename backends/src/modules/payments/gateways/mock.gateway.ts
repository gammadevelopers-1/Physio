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
} from './payment-gateway.interface';

@Injectable()
export class MockGateway implements PaymentGateway {
  readonly name = 'mock' as const;
  private readonly logger = new Logger(MockGateway.name);

  constructor(private readonly configService: ConfigService) {}

  async createCharge(params: CreateChargeParams): Promise<ChargeResult> {
    const chargeId = `mock_chg_${randomUUID()}`;
    const callbackUrl = this.configService.get<string>('payments.callbackUrl');

    this.logger.log(
      `[MockGateway] Creating charge ${chargeId} for ${params.amount} ${params.currency}`,
    );

    const redirectUrl = `${callbackUrl}?gateway=mock&charge_id=${chargeId}&status=paid&payment_id=${params.metadata.paymentId}`;

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
      status: 'paid',
      amount: 0,
      currency: 'SAR',
    };
  }
}
