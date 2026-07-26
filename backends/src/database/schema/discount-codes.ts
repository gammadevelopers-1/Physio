import {
  pgTable,
  uuid,
  varchar,
  numeric,
  integer,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { payments } from './payments';

export const discountCodes = pgTable(
  'discount_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 50 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    value: numeric('value', { precision: 10, scale: 2 }).notNull(),
    maxUses: integer('max_uses'),
    // Per-user redemption cap. NULL = unlimited per user; default 1 preserves
    // the previous hardcoded "one use per user" behaviour.
    maxUsesPerUser: integer('max_uses_per_user').default(1),
    currentUses: integer('current_uses').notNull().default(0),
    minOrderAmount: numeric('min_order_amount', { precision: 10, scale: 2 }),
    applicableCourses: uuid('applicable_courses').array().notNull().default(sql`'{}'::uuid[]`),
    validFrom: timestamp('valid_from'),
    validUntil: timestamp('valid_until'),
    isActive: boolean('is_active').notNull().default(true),
    // Optional grouping label for promotional campaigns (e.g. "Ramadan 2026").
    // Legacy text label — new codes should attach via `campaignId` (FK to
    // coupon_campaigns). Kept for backward compatibility.
    campaign: varchar('campaign', { length: 100 }),
    /**
     * FK to coupon_campaigns. When the parent campaign ends or hits its
     * budget, code is treated as inactive (checked in validateDiscount).
     * Nullable so standalone codes still work.
     *
     * NOTE: Drizzle FK omitted intentionally to avoid circular schema
     * import (campaigns ↔ codes). Enforced in service layer + validated
     * at the index level.
     */
    campaignId: uuid('campaign_id'),
    /**
     * Early-bird auto-apply flag. When true, the code is applied to any
     * eligible cart automatically (no code-typing required). Surfaced as
     * a yellow "Early Bird" badge on the public course card while
     * within the validity window.
     */
    autoApply: boolean('auto_apply').notNull().default(false),
    /**
     * Explicit early-bird marker. Decoupled from `autoApply` so finance
     * can run an early-bird campaign that still requires a code (the
     * code just earns a special badge + counter), and conversely have
     * silent auto-apply codes that aren't billed as "early bird".
     */
    earlyBird: boolean('early_bird').notNull().default(false),
    /**
     * Link back to the bulk-generation batch this code came from (if
     * any). Lets the dashboard surface "batch X has used 40/50 codes"
     * without aggregating ad-hoc on prefix.
     */
    batchId: uuid('batch_id'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /**
     * When set, only this user can redeem the code. Used by the points
     * rewards system: a "get SAR 50 off" reward mints a discount code with
     * target_user_id = redeeming student, so sharing the code with someone
     * else is a no-op. NULL for admin-created public codes.
     */
    targetUserId: uuid('target_user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('discount_codes_code_unique').on(table.code),
    index('discount_codes_is_active_idx').on(table.isActive),
    index('discount_codes_campaign_idx').on(table.campaign),
    index('discount_codes_target_user_id_idx').on(table.targetUserId),
    check(
      'discount_codes_type_check',
      sql`${table.type} IN ('percentage', 'fixed')`,
    ),
  ],
);

export const discountCodesRelations = relations(discountCodes, ({ one }) => ({
  creator: one(users, {
    fields: [discountCodes.createdBy],
    references: [users.id],
  }),
}));

export const discountUsage = pgTable(
  'discount_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    discountId: uuid('discount_id')
      .notNull()
      .references(() => discountCodes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    amountSaved: numeric('amount_saved', {
      precision: 10,
      scale: 2,
    }).notNull(),
    usedAt: timestamp('used_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('discount_usage_unique').on(
      table.discountId,
      table.userId,
      table.paymentId,
    ),
    index('discount_usage_discount_id_idx').on(table.discountId),
    index('discount_usage_user_id_idx').on(table.userId),
  ],
);

export const discountUsageRelations = relations(discountUsage, ({ one }) => ({
  discount: one(discountCodes, {
    fields: [discountUsage.discountId],
    references: [discountCodes.id],
  }),
  user: one(users, {
    fields: [discountUsage.userId],
    references: [users.id],
  }),
  payment: one(payments, {
    fields: [discountUsage.paymentId],
    references: [payments.id],
  }),
}));

/**
 * Bulk-generation batches. Every time finance generates N codes from the
 * "Bulk Generate" flow, a batch row is written. Codes link back via
 * `discount_codes.batch_id` so we can show "batch X: 23/50 redeemed"
 * without aggregating on the prefix string (prefixes can collide).
 */
export const discountCodeBatches = pgTable(
  'discount_code_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    prefix: varchar('prefix', { length: 50 }).notNull(),
    requestedCount: integer('requested_count').notNull(),
    createdCount: integer('created_count').notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    value: numeric('value', { precision: 10, scale: 2 }).notNull(),
    maxUses: integer('max_uses'),
    maxUsesPerUser: integer('max_uses_per_user'),
    campaignId: uuid('campaign_id'),
    campaignLabel: varchar('campaign_label', { length: 100 }),
    minOrderAmount: numeric('min_order_amount', { precision: 10, scale: 2 }),
    applicableCourses: uuid('applicable_courses').array().notNull().default(sql`'{}'::uuid[]`),
    validFrom: timestamp('valid_from'),
    validUntil: timestamp('valid_until'),
    earlyBird: boolean('early_bird').notNull().default(false),
    autoApply: boolean('auto_apply').notNull().default(false),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('discount_code_batches_created_at_idx').on(table.createdAt),
    index('discount_code_batches_campaign_id_idx').on(table.campaignId),
  ],
);

export type DiscountCode = typeof discountCodes.$inferSelect;
export type NewDiscountCode = typeof discountCodes.$inferInsert;
export type DiscountUsage = typeof discountUsage.$inferSelect;
export type NewDiscountUsage = typeof discountUsage.$inferInsert;
export type DiscountCodeBatch = typeof discountCodeBatches.$inferSelect;
export type NewDiscountCodeBatch = typeof discountCodeBatches.$inferInsert;

export const DISCOUNT_TYPE = {
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
} as const;

export type DiscountType =
  (typeof DISCOUNT_TYPE)[keyof typeof DISCOUNT_TYPE];
