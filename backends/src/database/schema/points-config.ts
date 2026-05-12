import {
  pgTable,
  integer,
  timestamp,
  boolean,
  uuid,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

/**
 * points_config — singleton config row (id always = 1).
 *
 * The CHECK (id = 1) enforces singleton-ness: only one row can ever exist.
 * Trying to insert a second row throws a constraint violation.
 *
 * Fields:
 *  - conversion_rate_points_per_sar: how many points equal 1 SAR (e.g. 10 = "10 pts = 1 SAR")
 *  - min_redemption_points: floor for any single redemption (prevents micro-discounts)
 *  - max_redemption_pct: cap on % of course price that can be paid via points
 *    (per-course override available in course_redemption_settings)
 *  - combinable_with_coupons: when coupons exist, can points stack? (default false)
 *  - default_expiration_days: applied when a rule does not specify its own
 */
export const pointsConfig = pgTable(
  'points_config',
  {
    id: integer('id').primaryKey().default(1),
    conversionRatePointsPerSar: integer('conversion_rate_points_per_sar')
      .notNull()
      .default(10),
    minRedemptionPoints: integer('min_redemption_points').notNull().default(100),
    maxRedemptionPct: integer('max_redemption_pct').notNull().default(50),
    combinableWithCoupons: boolean('combinable_with_coupons')
      .notNull()
      .default(false),
    defaultExpirationDays: integer('default_expiration_days'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    updatedBy: uuid('updated_by').references(() => users.id),
  },
  (table) => [
    check('points_config_singleton', sql`${table.id} = 1`),
    check(
      'points_config_max_redemption_pct_range',
      sql`${table.maxRedemptionPct} >= 0 AND ${table.maxRedemptionPct} <= 100`,
    ),
    check(
      'points_config_conversion_positive',
      sql`${table.conversionRatePointsPerSar} > 0`,
    ),
  ],
);

export type PointsConfig = typeof pointsConfig.$inferSelect;
export type NewPointsConfig = typeof pointsConfig.$inferInsert;
