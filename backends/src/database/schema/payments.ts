import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { courses } from './courses';
import { enrollments } from './enrollments';

/**
 * Payment records for paid courses. Today the platform only writes
 * "placeholder" rows from the checkout endpoint — when the real payment
 * provider (Stripe / HyperPay / etc.) is integrated, only the provider +
 * providerRef + status fields change. The shape stays the same so the
 * upcoming finance dashboard can read against this table from day one.
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id),
    enrollmentId: uuid('enrollment_id').references(() => enrollments.id, {
      onDelete: 'set null',
    }),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('SAR'),
    status: varchar('status', { length: 20 }).notNull().default('completed'),
    provider: varchar('provider', { length: 50 }).notNull().default('placeholder'),
    providerRef: varchar('provider_ref', { length: 255 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('payments_user_id_idx').on(table.userId),
    index('payments_course_id_idx').on(table.courseId),
    index('payments_enrollment_id_idx').on(table.enrollmentId),
    index('payments_status_idx').on(table.status),
    index('payments_created_at_idx').on(table.createdAt),
    check(
      'payments_status_check',
      sql`${table.status} IN ('pending', 'completed', 'failed', 'refunded')`,
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
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const PAYMENT_PROVIDER = {
  PLACEHOLDER: 'placeholder',
  STRIPE: 'stripe',
  HYPERPAY: 'hyperpay',
} as const;
