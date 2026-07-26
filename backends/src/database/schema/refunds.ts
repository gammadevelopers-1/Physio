import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  text,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { payments } from './payments';
import { invoices } from './invoices';

export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id').references(() => invoices.id, {
      onDelete: 'set null',
    }),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    processedBy: uuid('processed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    reason: varchar('reason', { length: 30 }).notNull(),
    reasonNote: text('reason_note'),
    originalAmount: numeric('original_amount', {
      precision: 10,
      scale: 2,
    }).notNull(),
    deductionAmount: numeric('deduction_amount', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    deductionReason: text('deduction_reason'),
    refundAmount: numeric('refund_amount', {
      precision: 10,
      scale: 2,
    }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    gatewayRefundId: varchar('gateway_refund_id', { length: 255 }),
    approvedAt: timestamp('approved_at'),
    completedAt: timestamp('completed_at'),
    rejectedAt: timestamp('rejected_at'),
    rejectionNote: text('rejection_note'),
    approvalNote: text('approval_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('refunds_payment_id_idx').on(table.paymentId),
    index('refunds_status_idx').on(table.status),
    index('refunds_requested_by_idx').on(table.requestedBy),
    check(
      'refunds_reason_check',
      sql`${table.reason} IN ('policy', 'cancelled', 'technical', 'duplicate', 'other', 'course_cancelled', 'description_mismatch', 'wrong_course', 'access_issue')`,
    ),
    check(
      'refunds_status_check',
      sql`${table.status} IN ('pending', 'approved', 'rejected', 'processing', 'completed', 'failed')`,
    ),
  ],
);

export const refundsRelations = relations(refunds, ({ one }) => ({
  payment: one(payments, {
    fields: [refunds.paymentId],
    references: [payments.id],
  }),
  invoice: one(invoices, {
    fields: [refunds.invoiceId],
    references: [invoices.id],
  }),
  requester: one(users, {
    fields: [refunds.requestedBy],
    references: [users.id],
    relationName: 'refundRequester',
  }),
  processor: one(users, {
    fields: [refunds.processedBy],
    references: [users.id],
    relationName: 'refundProcessor',
  }),
}));

export type Refund = typeof refunds.$inferSelect;
export type NewRefund = typeof refunds.$inferInsert;

export const REFUND_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type RefundStatus = (typeof REFUND_STATUS)[keyof typeof REFUND_STATUS];

export const REFUND_REASON = {
  /** Legacy — kept for historical rows only; the buyer-facing modal no
   *  longer offers this option. */
  POLICY: 'policy',
  /** Buyer-initiated cancellation ("changed my mind"). */
  CANCELLED: 'cancelled',
  TECHNICAL: 'technical',
  DUPLICATE: 'duplicate',
  OTHER: 'other',
  /** Admin cancelled the entire course. Phase F fix: distinct from
   *  `cancelled` so the finance UI labels the reason honestly instead
   *  of showing "Buyer Changed Mind" for admin-initiated refunds. */
  COURSE_CANCELLED: 'course_cancelled',
  /** Buyer says the course content does not match the marketing copy. */
  DESCRIPTION_MISMATCH: 'description_mismatch',
  /** Buyer bought the wrong course (intended a different SKU). */
  WRONG_COURSE: 'wrong_course',
  /** Buyer can't access the course (enrollment, permissions, etc). */
  ACCESS_ISSUE: 'access_issue',
} as const;

export type RefundReason = (typeof REFUND_REASON)[keyof typeof REFUND_REASON];
