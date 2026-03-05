export type NormalizedPaymentStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'cancelled'
  | 'unknown';

export interface GatewayHealthResult {
  gateway: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs?: number;
  error?: string;
  checkedAt: Date;
}

export interface InstallmentOption {
  installments: number;
  monthlyAmount: number;
  totalAmount: number;
  currency: string;
}

export interface SupportedPaymentMethod {
  type: 'card' | 'bnpl' | 'wallet' | 'bank_transfer';
  label: string;
  currencies: string[];
  installmentOptions?: InstallmentOption[];
}
