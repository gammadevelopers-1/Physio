import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  varchar,
  boolean,
  index,
  unique,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';

/**
 * point_rules — admin-configured earn rules for the points system.
 *
 * Each rule_key corresponds to a specific user action that awards points.
 * Seeded keys: 'signup', 'course_completed', 'review_approved'.
 *
 * - is_active: lets admin disable a rule without deleting it (history stays valid).
 * - max_per_user: caps how many times a single user can earn from this rule
 *   (null = unlimited; e.g. 1 for 'signup', null for 'course_completed').
 * - cooldown_seconds: prevents spam earning (e.g. multiple rapid review submissions).
 * - expires_after_days: per-rule expiration policy. Each ledger row earned via this
 *   rule inherits this expiration; null = points never expire.
 */
export const pointRules = pgTable(
  'point_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ruleKey: varchar('rule_key', { length: 50 }).notNull(),
    pointsAmount: integer('points_amount').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    maxPerUser: integer('max_per_user'),
    cooldownSeconds: integer('cooldown_seconds'),
    description: text('description'),
    descriptionAr: text('description_ar'),
    expiresAfterDays: integer('expires_after_days'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    updatedBy: uuid('updated_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('point_rules_rule_key_unique').on(table.ruleKey),
    index('point_rules_active_idx').on(table.isActive),
    check('point_rules_amount_non_negative', sql`${table.pointsAmount} >= 0`),
  ],
);

export const pointRulesRelations = relations(pointRules, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [pointRules.updatedBy],
    references: [users.id],
  }),
}));

export type PointRule = typeof pointRules.$inferSelect;
export type NewPointRule = typeof pointRules.$inferInsert;
