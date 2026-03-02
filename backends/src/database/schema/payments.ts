import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  jsonb,
  text,
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
      sql`${table.gateway} IN ('tap', 'moyasar', 'tamara', 'tabby', 'mock')`,
    ),
    check(
      'payments_status_check',
      sql`${table.status} IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'partially_refunded')`,
    ),
    check(
      'payments_method_check',
      sql`${table.paymentMethod} IS NULL OR ${table.paymentMethod} IN ('card', 'mada', 'apple_pay', 'bnpl')`,
    ),
  ],
);

export const paymentsRelations = relations(payments, ({ one }) => ({
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
}));

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const PAYMENT_GATEWAY = {
  TAP: 'tap',
  MOYASAR: 'moyasar',
  TAMARA: 'tamara',
  TABBY: 'tabby',
  MOCK: 'mock',
} as const;

export type PaymentGatewayType =
  (typeof PAYMENT_GATEWAY)[keyof typeof PAYMENT_GATEWAY];

export const PAYMENT_METHOD = {
  CARD: 'card',
  MADA: 'mada',
  APPLE_PAY: 'apple_pay',
  BNPL: 'bnpl',
} as const;

export type PaymentMethodType =
  (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];
