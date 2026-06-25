export type NormalizedErrorCode =
  | 'insufficient_funds'
  | 'card_expired'
  | 'card_declined'
  | '3ds_failed'
  | 'do_not_honor'
  | 'invalid_card'
  | 'gateway_timeout'
  | 'gateway_error'
  | 'network_error'
  | 'payment_disputed'
  // Tabby pre-scoring outcomes — surfaced when their /checkout response
  // reports status: 'rejected'. Each has a distinct user-facing message
  // prescribed by Tabby's docs.
  | 'tabby_not_available'
  | 'tabby_amount_too_high'
  | 'tabby_amount_too_low'
  | 'unknown';

export class PaymentGatewayError extends Error {
  constructor(
    public readonly gateway: string,
    public readonly originalMessage: string,
    public readonly normalizedCode: NormalizedErrorCode,
    public readonly rawError?: any,
  ) {
    super(`[${gateway}] ${originalMessage} (${normalizedCode})`);
    this.name = 'PaymentGatewayError';
  }
}
