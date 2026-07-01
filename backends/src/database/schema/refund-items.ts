import {
  pgTable,
  uuid,
  numeric,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { refunds } from './refunds';
import { paymentItems } from './payments';
import { courses } from './courses';
import { enrollments } from './enrollments';

// refund_items — junction naming which cart lines a refund covered.
//
// Multi-course payments produce one payment + N payment_items. A refund
// for that payment can be FULL (covers all lines) or PARTIAL (covers a
// subset). refund_items captures exactly which lines were refunded so the
// cascade drops only those enrollments / revokes only those certificates.
//
// Legacy refunds inserted before this migration have zero refund_items
// rows; the cascade falls back to "all payment_items on the payment" via
// the resolver in RefundService.completeRefund.

export const refundItems = pgTable(
  'refund_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    refundId: uuid('refund_id')
      .notNull()
      .references(() => refunds.id, { onDelete: 'cascade' }),
    paymentItemId: uuid('payment_item_id')
      .notNull()
      .references(() => paymentItems.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id),
    enrollmentId: uuid('enrollment_id').references(() => enrollments.id, {
      onDelete: 'set null',
    }),
    // Cash math snapshot at the time of refund — line totals can drift if
    // the underlying payment_items rows are touched later (they shouldn't,
    // but the snapshot keeps refund history auditable regardless).
    lineAmount: numeric('line_amount', { precision: 10, scale: 2 }).notNull(),
    lineVat: numeric('line_vat', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    lineDiscount: numeric('line_discount', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    lineTotal: numeric('line_total', { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_refund_items_refund').on(table.refundId),
    index('idx_refund_items_payment_item').on(table.paymentItemId),
    index('idx_refund_items_course').on(table.courseId),
    index('idx_refund_items_enrollment').on(table.enrollmentId),
    uniqueIndex('idx_refund_items_unique_per_refund').on(
      table.refundId,
      table.paymentItemId,
    ),
    check('refund_items_line_amount_check', sql`${table.lineAmount}   >= 0`),
    check('refund_items_line_vat_check',    sql`${table.lineVat}      >= 0`),
    check('refund_items_line_disc_check',   sql`${table.lineDiscount} >= 0`),
    check('refund_items_line_total_check',  sql`${table.lineTotal}    >= 0`),
  ],
);

export const refundItemsRelations = relations(refundItems, ({ one }) => ({
  refund: one(refunds, {
    fields: [refundItems.refundId],
    references: [refunds.id],
  }),
  paymentItem: one(paymentItems, {
    fields: [refundItems.paymentItemId],
    references: [paymentItems.id],
  }),
  course: one(courses, {
    fields: [refundItems.courseId],
    references: [courses.id],
  }),
  enrollment: one(enrollments, {
    fields: [refundItems.enrollmentId],
    references: [enrollments.id],
  }),
}));

export type RefundItem = typeof refundItems.$inferSelect;
export type NewRefundItem = typeof refundItems.$inferInsert;
