export interface PaymentInitResponse {
  paymentId: string;
  redirectUrl: string;
  amount: number;
  currency: string;
}

export interface PaymentVerifyResponse {
  status: string;
  paymentId: string;
  amount?: string;
  currency?: string;
  gateway?: string;
  paidAt?: string;
}

export interface PaymentRecord {
  id: string;
  courseId: string;
  courseTitle: string | null;
  courseTitleAr: string | null;
  gateway: string;
  paymentMethod: string | null;
  amount: string;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

export interface PaymentListResponse {
  data: PaymentRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminPaymentRecord extends PaymentRecord {
  userId: string;
  userName: string;
  userEmail: string;
  failedAt: string | null;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  courseTitle: string | null;
  courseTitleAr: string | null;
  totalAmount: string;
  status: string;
  issuedAt: string;
  paidAt: string | null;
}

export interface AdminInvoiceRecord extends InvoiceRecord {
  userName: string;
  userEmail: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
}

export interface InvoiceListResponse {
  data: InvoiceRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RefundRecord {
  id: string;
  paymentId: string;
  requesterName: string;
  requesterEmail: string;
  reason: string;
  reasonNote: string | null;
  originalAmount: string;
  deductionAmount: string;
  refundAmount: string;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  completedAt: string | null;
  rejectedAt: string | null;
  rejectionNote: string | null;
}

export interface RefundListResponse {
  data: RefundRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DiscountCode {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: string;
  maxUses: number | null;
  currentUses: number;
  minOrderAmount: string | null;
  courseId: string | null;
  courseTitle: string | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface DiscountListResponse {
  data: DiscountCode[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DiscountValidationResponse {
  valid: boolean;
  discountAmount: number;
  discountId: string | null;
  error?: string;
}

export interface FinanceSummary {
  totalRevenue: number;
  totalPayments: number;
  totalRefunds: number;
  netRevenue: number;
  pendingPayments: number;
  pendingAmount: number;
  failedPayments: number;
  averageOrderValue: number;
}

export interface RevenueBySource {
  gateway: string;
  totalRevenue: number;
  count: number;
}

export interface PaymentStatusBreakdown {
  status: string;
  count: number;
  totalAmount: number;
}

export interface RefundRate {
  totalPaid: number;
  totalRefunded: number;
  refundRate: string;
  refundedAmount: number;
  paidAmount: number;
}

export interface InvoiceAging {
  current: number;
  thirtyDay: number;
  sixtyDay: number;
  ninetyPlus: number;
  paid: number;
}
