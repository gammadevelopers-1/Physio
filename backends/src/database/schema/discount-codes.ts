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
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('discount_codes_code_unique').on(table.code),
    index('discount_codes_is_active_idx').on(table.isActive),
    index('discount_codes_campaign_idx').on(table.campaign),
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

export type DiscountCode = typeof discountCodes.$inferSelect;
export type NewDiscountCode = typeof discountCodes.$inferInsert;
export type DiscountUsage = typeof discountUsage.$inferSelect;
export type NewDiscountUsage = typeof discountUsage.$inferInsert;

export const DISCOUNT_TYPE = {
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
} as const;

export type DiscountType =
  (typeof DISCOUNT_TYPE)[keyof typeof DISCOUNT_TYPE];
