import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { discountCodes } from './discount-codes';

/**
 * Promotional campaign — a parent entity that groups multiple discount
 * codes (e.g. "Ramadan 2026", "Back-to-Practice 2026"). Finance can set
 * a total budget; the system auto-deactivates child codes when the
 * campaign's `endsAt` passes OR `currentSpend >= budget`.
 *
 * `showOnSite=true` surfaces a public banner on the courses/detail pages
 * so visitors see the active promo.
 *
 * The legacy `discount_codes.campaign` text label still exists for
 * backwards compatibility but new campaigns should attach via
 * `discount_codes.campaignId`.
 */
export const couponCampaigns = pgTable(
  'coupon_campaigns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    startsAt: timestamp('starts_at'),
    endsAt: timestamp('ends_at'),
    /** Optional total-savings budget in SAR. NULL = unlimited. */
    budget: numeric('budget', { precision: 12, scale: 2 }),
    /** Running total of SAR discounted across child codes. */
    currentSpend: numeric('current_spend', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    isActive: boolean('is_active').notNull().default(true),
    /** Surface a public banner on courses pages while active. */
    showOnSite: boolean('show_on_site').notNull().default(false),
    /** Optional CTA shown in the banner (e.g. discount code or button label). */
    bannerCta: varchar('banner_cta', { length: 80 }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('coupon_campaigns_is_active_idx').on(table.isActive),
    index('coupon_campaigns_show_on_site_idx').on(table.showOnSite),
    index('coupon_campaigns_ends_at_idx').on(table.endsAt),
  ],
);

export const couponCampaignsRelations = relations(
  couponCampaigns,
  ({ many, one }) => ({
    codes: many(discountCodes),
    creator: one(users, {
      fields: [couponCampaigns.createdBy],
      references: [users.id],
    }),
  }),
);

export type CouponCampaign = typeof couponCampaigns.$inferSelect;
export type NewCouponCampaign = typeof couponCampaigns.$inferInsert;
