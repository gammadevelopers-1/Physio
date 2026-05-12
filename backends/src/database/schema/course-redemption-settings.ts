import {
  pgTable,
  uuid,
  integer,
  timestamp,
  boolean,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { courses } from './courses';

/**
 * course_redemption_settings — per-course override for points redemption.
 *
 * OPT-IN by design: a course is NOT redeemable until an admin explicitly
 * inserts a row here (or flips the flag in the existing row). Prevents
 * accidental "free unlock" of premium / CME-accredited courses.
 *
 * - redeemable_for_free: gate for the Phase 2 "unlock free with points" flow
 * - free_unlock_cost_points: explicit cost in points (overrides
 *   course.price × conversion_rate calculation; lets admin offer promotional
 *   discounts that don't follow the global formula)
 * - max_redemption_pct: per-course cap on % discount, overrides global
 *   points_config.max_redemption_pct
 */
export const courseRedemptionSettings = pgTable(
  'course_redemption_settings',
  {
    courseId: uuid('course_id')
      .primaryKey()
      .references(() => courses.id, { onDelete: 'cascade' }),
    redeemableForFree: boolean('redeemable_for_free').notNull().default(false),
    freeUnlockCostPoints: integer('free_unlock_cost_points'),
    maxRedemptionPct: integer('max_redemption_pct'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    check(
      'course_redemption_max_pct_range',
      sql`${table.maxRedemptionPct} IS NULL OR (${table.maxRedemptionPct} >= 0 AND ${table.maxRedemptionPct} <= 100)`,
    ),
    check(
      'course_redemption_cost_positive',
      sql`${table.freeUnlockCostPoints} IS NULL OR ${table.freeUnlockCostPoints} > 0`,
    ),
  ],
);

export const courseRedemptionSettingsRelations = relations(
  courseRedemptionSettings,
  ({ one }) => ({
    course: one(courses, {
      fields: [courseRedemptionSettings.courseId],
      references: [courses.id],
    }),
  }),
);

export type CourseRedemptionSetting =
  typeof courseRedemptionSettings.$inferSelect;
export type NewCourseRedemptionSetting =
  typeof courseRedemptionSettings.$inferInsert;
