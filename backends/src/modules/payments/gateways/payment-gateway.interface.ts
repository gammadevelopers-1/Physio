import {
  GatewayHealthResult,
  NormalizedPaymentStatus,
  SupportedPaymentMethod,
  InstallmentOption,
} from './gateway-types';

/** One past purchase by the buyer — feeds Tabby's order_history and other
 *  gateways' risk-scoring inputs. Pre-computed in the service layer (one
 *  query per checkout) so individual gateway code stays I/O-free. */
export interface BuyerPastOrder {
  /** ISO 8601 timestamp when the order was paid (or created, for non-paid). */
  purchasedAt: string;
  /** Decimal string with 2dp (SAR). */
  amount: string;
  /** Mapped to Tabby's vocab: new|processing|complete|refunded|canceled|unknown. */
  status: 'new' | 'processing' | 'complete' | 'refunded' | 'canceled' | 'unknown';
  /** Short item title (course name). Used to populate the `items[]` line
   *  in Tabby's order_history entry. */
  itemTitle: string;
}

/** Pre-computed buyer-history snapshot for BNPL underwriting. Built once in
 *  payments.service before calling gateway.createCharge so gateways don't
 *  need their own DB access. Non-Tabby gateways simply ignore unused fields. */
export interface BuyerHistory {
  /** Total successful purchases (any gateway, any time). Tabby's loyalty
   *  signal. Zero is fine for first-time buyers. */
  loyaltyLevel: number;
  /** Up to 10 previous orders, newest first, EXCLUDING the current one. */
  pastOrders: BuyerPastOrder[];
}

/** Vertical-specific info Tabby asks for in the `attachment` field. For
 *  PhysioGuidance this is always educational. Caller fills in what they
 *  know about the course; gateway defaults the rest. Also feeds Tamara's
 *  `education` object (educational-services onboarding requirement — see
 *  docs.tamara.co/docs/other-educational-services) so the fields overlap. */
export interface EducationDetails {
  /** Tabby vocab: 'formal_education' (degree programs) | 'courses_training'
   *  (continuing education / short courses). PhysioGuidance is the latter. */
  merchantSubtype: 'formal_education' | 'courses_training';
  /** Expected months from purchase to course completion. Defaults to 1. */
  monthsToCompletion: number;
  /** Course start / end (ISO YYYY-MM-DD). Tamara wants these on the
   *  `education` object; Tabby ignores. Omit for open-ended / self-paced
   *  courses — the gateway falls back to "now" and "now + monthsToCompletion". */
  courseStartDate?: string;
  courseEndDate?: string;
}

export interface CreateChargeParams {
  amount: number;
  currency: string;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  /** Plaintext KSA National ID / Iqama (10 digits). Tamara REQUIRES this
   *  on `consumer.national_id` to run their SIMAH risk check — omitting it
   *  causes all installment plans to lock at their hosted checkout, leaving
   *  only Pay-in-Full available. Caller decrypts from users.national_id
   *  (AES-GCM at rest). Also fed into Tamara's risk_assessment context. */
  customerNationalId?: string;
  /** ISO 8601 date (YYYY-MM-DD). Tamara accepts on `consumer.date_of_birth`
   *  and uses it as a soft eligibility signal; omit if the buyer has no
   *  DOB on file. */
  customerDateOfBirth?: string;
  /** ISO timestamp of when the buyer first registered. BNPL gateways
   *  (Tabby in particular) feed this into their risk model — passing
   *  "now" hurts approval rates for established customers. */
  customerRegisteredSince?: string;
  /** Optional buyer-history snapshot for BNPL underwriting. Tabby uses it
   *  for order_history + loyalty_level. Omit for non-BNPL flows. */
  buyerHistory?: BuyerHistory;
  /** Optional vertical-specific details for BNPL `attachment` field. */
  educationDetails?: EducationDetails;
  redirectUrl: string;
  /** Where to send the buyer if they click "Back"/cancel on the gateway's
   *  hosted page. For Tabby per their QA this should land on a page that
   *  shows the buyer the prescribed cancellation copy. */
  cancelUrl?: string;
  /** Where to send the buyer when the gateway itself rejects the payment
   *  (e.g. Tabby returns FAILED). Distinct from cancelUrl so the
   *  landing page can show "we couldn't approve" vs "you cancelled"
   *  copy. Falls back to cancelUrl when omitted (backwards-compat). */
  failureUrl?: string;
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

/** Per-line breakdown that Tabby's optional `items[]` accepts. Surfaces
 *  in the merchant portal so ops can trace WHICH cart lines a partial
 *  refund covered without joining tables. Tamara's simplified-refund
 *  endpoint ignores it; Moyasar/Bank Transfer don't accept it either. */
export interface RefundLineItem {
  /** Course id — passed as reference_id to Tabby. */
  referenceId: string;
  /** Short display name (course title). */
  title: string;
  /** Line refund amount in major units. */
  unitPrice: number;
  /** Always 1 in our model (a course is owned or not). */
  quantity: number;
  /** Same category we send on createCharge. */
  category?: string;
}

export interface RefundParams {
  gatewayChargeId: string;
  amount: number;
  reason?: string;
  // Our internal refund row id. Passed to gateways that support an
  // idempotency / reference key (e.g. Tabby's `reference_id`) so a retried
  // gateway call after a timeout / network blip can't double-refund.
  refundId?: string;
  /** Optional per-line breakdown. Only consumed by Tabby (sent as the
   *  optional `items[]` array on POST /payments/{id}/refunds). Other
   *  gateways ignore it — the total `amount` above is the source of truth
   *  for what the buyer actually receives. */
  items?: RefundLineItem[];
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
