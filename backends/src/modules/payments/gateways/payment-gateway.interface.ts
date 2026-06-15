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
  redirectUrl: string;
  webhookUrl: string;
  metadata: {
    paymentId: string;
    enrollmentId: string;
    courseId: string;
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
}

export interface RefundResult {
  refundId: string;
  status: string;
  rawResponse?: any;
}

export interface WebhookResult {
  chargeId: string;
  status: 'paid' | 'failed' | 'refunded' | 'pending';
  errorCode?: string;
  rawData?: any;
}

export interface PaymentGateway {
  readonly name: 'tap' | 'moyasar' | 'tamara' | 'tabby' | 'mock';

  createCharge(params: CreateChargeParams): Promise<ChargeResult>;

  verifyWebhook(headers: Record<string, string>, body: any): boolean;

  processWebhook(body: any): WebhookResult;

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
