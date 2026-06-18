import { Injectable, Logger } from '@nestjs/common';
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

/**
 * Bank Transfer "gateway" — out-of-band manual flow.
 *
 * Unlike API-driven gateways, the student deposits to our bank account
 * externally, uploads a receipt via the BankTransferController, and finance
 * reviews + approves the payment manually. No external API call is made;
 * the gateway interface methods only exist so the rest of the payment
 * pipeline (initiatePayment, refunds, factory lookup) can treat bank
 * transfer as just another gateway.
 *
 * Status lifecycle:
 *   created → awaiting_approval (after receipt upload) →
 *   paid (finance approve) | failed (finance reject)
 *
 * Refunds are also manual: finance wires the money back via their banking
 * portal and records the transaction in the refunds table — no API call.
 */
@Injectable()
export class BankTransferGateway extends BaseGateway implements PaymentGateway {
  readonly name = 'bank_transfer' as const;
  protected readonly logger = new Logger(BankTransferGateway.name);

  async createCharge(params: CreateChargeParams): Promise<ChargeResult> {
    // No external charge to create. We synthesize a local "charge ID" so the
    // payments table has something unique to look up; the redirect URL points
    // the buyer to our own receipt-upload page rather than a hosted gateway
    // page. The charge stays in 'awaiting_approval' until finance acts.
    const chargeId = `bt_${params.metadata.paymentId}`;

    // Receipt upload page (FE handles the rest): /payment/bank-transfer/:paymentId
    // The redirectUrl passed in is the post-payment callback page — strip its
    // path and rebuild against the bank-transfer route so the buyer lands on
    // the upload form, not the "processing" spinner.
    let uploadUrl = params.redirectUrl;
    try {
      const u = new URL(params.redirectUrl);
      const localePrefix = (params.locale === 'ar' ? '/ar' : '/en');
      u.pathname = `${localePrefix}/payment/bank-transfer/${params.metadata.paymentId}`;
      u.search = '';
      uploadUrl = u.toString();
    } catch {
      // If redirectUrl wasn't a valid URL, fall back as-is — caller will surface.
    }

    this.logger.log(
      `BankTransfer charge created for payment=${params.metadata.paymentId}, awaiting receipt upload`,
    );

    return {
      chargeId,
      redirectUrl: uploadUrl,
      status: 'awaiting_approval',
      rawResponse: {
        type: 'bank_transfer',
        paymentId: params.metadata.paymentId,
        amount: params.amount,
        currency: params.currency,
      },
    };
  }

  /**
   * No webhook for bank transfers — finance approval is the only signal.
   * Returns true so the controller doesn't reject any spurious POSTs, but
   * processWebhook will throw if anything ever tries to dispatch one.
   */
  verifyWebhook(_headers: Record<string, string>, _body: any): boolean {
    return true;
  }

  async processWebhook(_body: any): Promise<WebhookResult> {
    throw new Error(
      'Bank transfers do not use webhooks — approval happens via the finance dashboard',
    );
  }

  /**
   * Manual refund — no API call. Returns a synthetic refund record so the
   * RefundService can persist it. Finance must wire the money back via their
   * banking portal and mark the refund completed manually.
   */
  async refund(params: RefundParams): Promise<RefundResult> {
    this.logger.log(
      `BankTransfer manual refund recorded: charge=${params.gatewayChargeId}, amount=${params.amount}`,
    );
    return {
      refundId: `bt_refund_${params.gatewayChargeId}_${Date.now()}`,
      status: 'pending_manual_transfer',
      rawResponse: {
        type: 'bank_transfer',
        note: 'Manual refund — finance must execute the transfer externally',
        ...params,
      },
    };
  }

  async getCharge(chargeId: string): Promise<any> {
    // No external system to query — return a minimal representation.
    return { chargeId, type: 'bank_transfer' };
  }

  async getPaymentStatus(_chargeId: string): Promise<NormalizedPaymentStatus> {
    // Status is driven by the receipts table + finance approval, not by us.
    // Caller (verifyByChargeId polling) should consult the payments row directly.
    return 'pending';
  }

  async healthCheck(): Promise<GatewayHealthResult> {
    // Always healthy — no external dependency.
    return {
      gateway: this.name,
      status: 'healthy',
      latencyMs: 0,
      checkedAt: new Date(),
    };
  }

  getSupportedPaymentMethods(): SupportedPaymentMethod[] {
    return [
      {
        type: 'bank_transfer',
        label: 'Bank Transfer',
        currencies: ['SAR'],
      },
    ];
  }
}
