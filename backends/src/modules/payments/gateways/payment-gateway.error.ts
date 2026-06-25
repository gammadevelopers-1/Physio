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
