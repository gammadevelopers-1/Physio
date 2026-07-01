import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  text,
  jsonb,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { courses } from './courses';
import { payments } from './payments';

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceNumber: varchar('invoice_number', { length: 20 }).notNull(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
    discountAmount: numeric('discount_amount', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    taxAmount: numeric('tax_amount', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('issued'),
    issuedAt: timestamp('issued_at').defaultNow().notNull(),
    paidAt: timestamp('paid_at'),
    dueDate: timestamp('due_date'),
    pdfUrl: text('pdf_url'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('invoices_invoice_number_unique').on(table.invoiceNumber),
    index('invoices_user_id_idx').on(table.userId),
    index('invoices_status_idx').on(table.status),
    index('invoices_payment_id_idx').on(table.paymentId),
    check(
      'invoices_status_check',
      sql`${table.status} IN ('draft', 'issued', 'paid', 'overdue', 'cancelled', 'refunded', 'partially_refunded')`,
    ),
  ],
);

export const invoicesRelations = relations(invoices, ({ one }) => ({
  payment: one(payments, {
    fields: [invoices.paymentId],
    references: [payments.id],
  }),
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [invoices.courseId],
    references: [courses.id],
  }),
}));

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export const INVOICE_STATUS = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
} as const;

export type InvoiceStatus =
  (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];
