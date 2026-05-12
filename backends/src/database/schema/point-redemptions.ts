import {
  pgTable,
  uuid,
  integer,
  timestamp,
  varchar,
  numeric,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { courses } from './courses';
import { enrollments } from './enrollments';

/**
 * point_redemptions — two-phase redemption events.
 *
 * Status lifecycle:
 *   pending  ── user creates hold (e.g. at checkout or free-unlock click)
 *     │       points are debited from ledger (reason='redeem:hold')
 *     ├──→ applied   payment / enrollment confirmed; debit becomes permanent
 *     ├──→ released  user cancelled or hold expired; ledger gets compensating credit
 *     └──→ reversed  post-confirmation refund; ledger gets compensating credit
 *
 * Holds expire after 30 minutes (expires_at) — a daily cron sweeps them and
 * inserts the release row. This guarantees nobody loses points to an
 * abandoned checkout flow.
 */
export const pointRedemptions = pgTable(
  'point_redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').references(() => courses.id, {
      onDelete: 'set null',
    }),
    pointsUsed: integer('points_used').notNull(),
    discountAmountSar: numeric('discount_amount_sar', {
      precision: 10,
      scale: 2,
    }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    enrollmentId: uuid('enrollment_id').references(() => enrollments.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at').notNull(),
    appliedAt: timestamp('applied_at'),
    releasedAt: timestamp('released_at'),
    reversedAt: timestamp('reversed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('point_redemptions_user_id_idx').on(table.userId),
    index('point_redemptions_status_idx').on(table.status),
    index('point_redemptions_expires_at_idx').on(table.expiresAt),
    check(
      'point_redemptions_status_check',
      sql`${table.status} IN ('pending', 'applied', 'released', 'reversed')`,
    ),
    check('point_redemptions_points_positive', sql`${table.pointsUsed} > 0`),
  ],
);

export const pointRedemptionsRelations = relations(
  pointRedemptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pointRedemptions.userId],
      references: [users.id],
    }),
    course: one(courses, {
      fields: [pointRedemptions.courseId],
      references: [courses.id],
    }),
    enrollment: one(enrollments, {
      fields: [pointRedemptions.enrollmentId],
      references: [enrollments.id],
    }),
  }),
);

export type PointRedemption = typeof pointRedemptions.$inferSelect;
export type NewPointRedemption = typeof pointRedemptions.$inferInsert;
