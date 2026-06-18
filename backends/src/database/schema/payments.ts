import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  jsonb,
  text,
  integer,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { courses } from './courses';
import { enrollments } from './enrollments';

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    enrollmentId: uuid('enrollment_id').references(() => enrollments.id, {
      onDelete: 'set null',
    }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    gateway: varchar('gateway', { length: 20 }).notNull(),
    gatewayChargeId: varchar('gateway_charge_id', { length: 255 }),
    paymentMethod: varchar('payment_method', { length: 20 }),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('SAR'),
    status: varchar('status', { length: 30 }).notNull().default('pending'),
    gatewayResponse: jsonb('gateway_response'),
    errorCode: varchar('error_code', { length: 50 }),
    paidAt: timestamp('paid_at'),
    failedAt: timestamp('failed_at'),
    failureReason: text('failure_reason'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('payments_user_id_idx').on(table.userId),
    index('payments_course_id_idx').on(table.courseId),
    index('payments_status_idx').on(table.status),
    index('payments_gateway_idx').on(table.gateway),
    index('payments_created_at_idx').on(table.createdAt),
    index('payments_gateway_charge_id_idx').on(table.gatewayChargeId),
    check(
      'payments_gateway_check',
      sql`${table.gateway} IN ('moyasar', 'tamara', 'tabby', 'bank_transfer', 'mock')`,
    ),
    check(
      'payments_status_check',
      sql`${table.status} IN ('pending', 'processing', 'awaiting_approval', 'paid', 'failed', 'refunded', 'partially_refunded', 'chargeback')`,
    ),
    check(
      'payments_method_check',
      sql`${table.paymentMethod} IS NULL OR ${table.paymentMethod} IN ('card', 'mada', 'apple_pay', 'bnpl', 'bank_transfer')`,
    ),
  ],
);

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [payments.courseId],
    references: [courses.id],
  }),
  enrollment: one(enrollments, {
    fields: [payments.enrollmentId],
    references: [enrollments.id],
  }),
  receipts: many(paymentReceipts),
  items: many(paymentItems),
}));

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  AWAITING_APPROVAL: 'awaiting_approval',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
  CHARGEBACK: 'chargeback',
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const PAYMENT_GATEWAY = {
  MOYASAR: 'moyasar',
  TAMARA: 'tamara',
  TABBY: 'tabby',
  BANK_TRANSFER: 'bank_transfer',
  MOCK: 'mock',
} as const;

export type PaymentGatewayType =
  (typeof PAYMENT_GATEWAY)[keyof typeof PAYMENT_GATEWAY];

export const PAYMENT_METHOD = {
  CARD: 'card',
  MADA: 'mada',
  APPLE_PAY: 'apple_pay',
  BNPL: 'bnpl',
  BANK_TRANSFER: 'bank_transfer',
} as const;

export type PaymentMethodType =
  (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

// ─── payment_receipts: bank transfer proof uploads ─────────────────────────

export const paymentReceipts = pgTable(
  'payment_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // File (stored in private GCS bucket)
    fileName: varchar('file_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull(),
    gcsObjectPath: text('gcs_object_path').notNull(),

    // Malware scan
    scanStatus: varchar('scan_status', { length: 20 }).notNull().default('pending'),
    scanEngine: varchar('scan_engine', { length: 50 }),
    scanCompletedAt: timestamp('scan_completed_at'),
    scanMeta: jsonb('scan_meta'),

    // Finance review
    reviewStatus: varchar('review_status', { length: 20 }).notNull().default('pending'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at'),
    reviewerNote: text('reviewer_note'),
    financeInternalNote: text('finance_internal_note'),

    // Student refund info (KSA, snapshot at upload time)
    refundAccountHolder: varchar('refund_account_holder', { length: 255 }).notNull(),
    refundIban: varchar('refund_iban', { length: 34 }).notNull(),
    refundBankName: varchar('refund_bank_name', { length: 255 }).notNull(),
    refundNationalId: varchar('refund_national_id', { length: 20 }),

    // Re-upload chain
    replacedById: uuid('replaced_by_id'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('payment_receipts_payment_id_idx').on(table.paymentId),
    index('payment_receipts_review_status_idx').on(table.reviewStatus),
    index('payment_receipts_scan_status_idx').on(table.scanStatus),
    index('payment_receipts_uploaded_by_idx').on(table.uploadedBy),
    check(
      'payment_receipts_scan_status_check',
      sql`${table.scanStatus} IN ('pending', 'clean', 'infected', 'error')`,
    ),
    check(
      'payment_receipts_review_status_check',
      sql`${table.reviewStatus} IN ('pending', 'approved', 'rejected')`,
    ),
  ],
);

export const paymentReceiptsRelations = relations(paymentReceipts, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentReceipts.paymentId],
    references: [payments.id],
  }),
  uploader: one(users, {
    fields: [paymentReceipts.uploadedBy],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [paymentReceipts.reviewedBy],
    references: [users.id],
  }),
}));

export type PaymentReceipt = typeof paymentReceipts.$inferSelect;
export type NewPaymentReceipt = typeof paymentReceipts.$inferInsert;

export const RECEIPT_SCAN_STATUS = {
  PENDING: 'pending',
  CLEAN: 'clean',
  INFECTED: 'infected',
  ERROR: 'error',
} as const;

export type ReceiptScanStatus =
  (typeof RECEIPT_SCAN_STATUS)[keyof typeof RECEIPT_SCAN_STATUS];

export const RECEIPT_REVIEW_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type ReceiptReviewStatus =
  (typeof RECEIPT_REVIEW_STATUS)[keyof typeof RECEIPT_REVIEW_STATUS];

// ─── payment_items: per-course line items inside a payment ───────────────
//
// A cart-checkout produces ONE payments row with N payment_items rows. After
// successful payment, each line is linked to the enrollment it created so
// per-line refunds remain possible. Legacy single-course payments may have
// zero payment_items rows — readers fall back to payments.course_id.

export const paymentItems = pgTable(
  'payment_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id),
    enrollmentId: uuid('enrollment_id').references(() => enrollments.id, {
      onDelete: 'set null',
    }),

    // Pricing snapshots — invoices must remain immutable even if course
    // prices change later.
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    salePrice: numeric('sale_price', { precision: 10, scale: 2 }).notNull(),
    discountAmount: numeric('discount_amount', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    lineTotal: numeric('line_total', { precision: 10, scale: 2 }).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_payment_items_payment').on(table.paymentId),
    index('idx_payment_items_course').on(table.courseId),
    index('idx_payment_items_enrollment').on(table.enrollmentId),
    check('payment_items_unit_price_check', sql`${table.unitPrice} >= 0`),
    check('payment_items_sale_price_check', sql`${table.salePrice} >= 0`),
    check('payment_items_discount_check', sql`${table.discountAmount} >= 0`),
    check('payment_items_line_total_check', sql`${table.lineTotal} >= 0`),
  ],
);

export const paymentItemsRelations = relations(paymentItems, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentItems.paymentId],
    references: [payments.id],
  }),
  course: one(courses, {
    fields: [paymentItems.courseId],
    references: [courses.id],
  }),
  enrollment: one(enrollments, {
    fields: [paymentItems.enrollmentId],
    references: [enrollments.id],
  }),
}));

export type PaymentItem = typeof paymentItems.$inferSelect;
export type NewPaymentItem = typeof paymentItems.$inferInsert;
