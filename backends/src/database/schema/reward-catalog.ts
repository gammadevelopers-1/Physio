import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';

/**
 * reward_catalog — admin-curated redeemable items for the points system.
 *
 * Per-type payload shapes (validated at the service layer, kept as JSONB
 * so admins can add new reward types without a migration):
 *
 *   discount_coupon:
 *     { percent: number, expiryDays: number,
 *       scope: 'all_paid'|'specific_courses'|'by_delivery_type',
 *       scopeCourseIds?: string[], deliveryTypes?: string[] }
 *
 *   fixed_discount_coupon:
 *     { amountSar: number, expiryDays: number, scope, scopeCourseIds?, deliveryTypes? }
 *
 *   free_course:   { courseIds: string[] }
 *                  (student picks ONE at redeem time; a data migration in
 *                   0108_reward_polish converted legacy `{ courseId }` rows)
 *   free_webinar:  { sessionId: string }
 *   other:         { instructionsEn?: string, instructionsAr?: string }
 *                  (manual admin fulfillment — redemption stays 'pending' until
 *                   admin flips it to 'fulfilled')
 */
export const REWARD_TYPES = [
  'discount_coupon',
  'fixed_discount_coupon',
  'free_course',
  'free_webinar',
  'other',
] as const;
export type RewardType = (typeof REWARD_TYPES)[number];

export const rewardCatalog = pgTable(
  'reward_catalog',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nameEn: varchar('name_en', { length: 200 }).notNull(),
    nameAr: varchar('name_ar', { length: 200 }),
    descriptionEn: text('description_en'),
    descriptionAr: text('description_ar'),
    icon: varchar('icon', { length: 50 }),
    type: varchar('type', { length: 30 }).$type<RewardType>().notNull(),
    pointsCost: integer('points_cost').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    isActive: boolean('is_active').notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),
    maxPerUser: integer('max_per_user'),
    totalStock: integer('total_stock'),
    totalRedeemed: integer('total_redeemed').notNull().default(0),
    validFrom: timestamp('valid_from'),
    validUntil: timestamp('valid_until'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('reward_catalog_active_idx').on(t.isActive),
    index('reward_catalog_display_order_idx').on(t.displayOrder),
    index('reward_catalog_type_idx').on(t.type),
    check(
      'reward_catalog_type_check',
      sql`${t.type} IN ('discount_coupon','fixed_discount_coupon','free_course','free_webinar','other')`,
    ),
    check('reward_catalog_points_cost_positive', sql`${t.pointsCost} > 0`),
  ],
);

export const rewardCatalogRelations = relations(rewardCatalog, ({ one }) => ({
  creator: one(users, {
    fields: [rewardCatalog.createdBy],
    references: [users.id],
  }),
}));

export type Reward = typeof rewardCatalog.$inferSelect;
export type NewReward = typeof rewardCatalog.$inferInsert;
