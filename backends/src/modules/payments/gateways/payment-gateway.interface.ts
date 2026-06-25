import {
  GatewayHealthResult,
  NormalizedPaymentStatus,
  SupportedPaymentMethod,
  InstallmentOption,
} from './gateway-types';

export interface CreateChargeParams {
  amount: number;
  currency: string;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  /** ISO timestamp of when the buyer first registered. BNPL gateways
   *  (Tabby in particular) feed this into their risk model — passing
   *  "now" hurts approval rates for established customers. */
  customerRegisteredSince?: string;
  redirectUrl: string;
  /** Where to send the buyer if they click "Back"/cancel on the gateway's
   *  hosted page — should be the checkout page, NOT the post-payment callback. */
  cancelUrl?: string;
  webhookUrl: string;
  metadata: {
    paymentId: string;
    enrollmentId: string;
    courseId: string;
    /** All courses in a cart-checkout. Single-course express buys send a
     *  one-element array. Stored on the gateway so refund / dispute lookups
     *  can recover the full purchase set. */
    courseIds?: string[];
    userId: string;
  };
  locale?: 'ar' | 'en';
  paymentMethod?: string;
}

export interface ChargeResult {
  chargeId: string;
  redirectUrl: string;
  status: string;
  rawResponse?: any;
}

export interface RefundParams {
  gatewayChargeId: string;
  amount: number;
  reason?: string;
  // Our internal refund row id. Passed to gateways that support an
  // idempotency / reference key (e.g. Tabby's `reference_id`) so a retried
  // gateway call after a timeout / network blip can't double-refund.
  refundId?: string;
}

export interface RefundResult {
  refundId: string;
  status: string;
  rawResponse?: any;
}

export interface WebhookResult {
  chargeId: string;
  status: 'paid' | 'failed' | 'refunded' | 'pending' | 'chargeback';
  errorCode?: string;
  rawData?: any;
}

export interface PaymentGateway {
  readonly name: 'moyasar' | 'tamara' | 'tabby' | 'bank_transfer' | 'mock';

  createCharge(params: CreateChargeParams): Promise<ChargeResult>;

  verifyWebhook(headers: Record<string, string>, body: any): boolean;

  /**
   * Process an inbound webhook body into a normalized result the controller can
   * route. Async because some gateways (notably Tamara) MUST make follow-up API
   * calls before they can answer "was the payment captured?" — see Tamara's
   * Approved → Authorise → Capture lifecycle. Pure gateways (Moyasar) implement
   * this as a synchronous body parse wrapped in `async`.
   */
  processWebhook(body: any): Promise<WebhookResult>;

  refund(params: RefundParams): Promise<RefundResult>;

  getCharge(chargeId: string): Promise<any>;

  getPaymentStatus(chargeId: string): Promise<NormalizedPaymentStatus>;

  healthCheck(): Promise<GatewayHealthResult>;

  getSupportedPaymentMethods(): SupportedPaymentMethod[];
}

export interface BnplPaymentGateway extends PaymentGateway {
  readonly isBnpl: true;
  readonly deductionRate: number; // e.g. 0.10 = 10%
  getInstallmentOptions(amount: number, currency: string): InstallmentOption[];
}

export function isBnplGateway(gateway: PaymentGateway): gateway is BnplPaymentGateway {
  return (gateway as BnplPaymentGateway).isBnpl === true;
}

export type {
  GatewayHealthResult,
  NormalizedPaymentStatus,
  SupportedPaymentMethod,
  InstallmentOption,
} from './gateway-types';
