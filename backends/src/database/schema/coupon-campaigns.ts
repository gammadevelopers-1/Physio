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
import { relations, sql } from 'drizzle-orm';
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
    /** Arabic display name. Optional — public UI falls back to `name`
     * when the visitor is on the Arabic locale and this is null. */
    nameAr: varchar('name_ar', { length: 100 }),
    description: text('description'),
    /** Arabic description. Same fallback rule as `nameAr`. */
    descriptionAr: text('description_ar'),
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
    /** Arabic variant of the banner CTA. Falls back to `bannerCta` when
     * null. Kept alongside `bannerCta` so finance can localize both. */
    bannerCtaAr: varchar('banner_cta_ar', { length: 80 }),
    /**
     * Link back to the bulk-generation batch that auto-created this
     * campaign. NULL for manually-created campaigns. Used by the
     * dashboard to render a "Bulk batch" badge and to group/exclude
     * machine-generated campaigns from manual reports if needed.
     */
    bulkBatchId: uuid('bulk_batch_id'),
    /**
     * Sub-type of the campaign. `early_bird` powers the Early Bird tab
     * (a filtered view of this table) so the client-facing "Early Bird"
     * feature is preserved without a separate data model.
     */
    campaignType: varchar('campaign_type', { length: 20 })
      .notNull()
      .default('standard'),
    /**
     * When set to 'percentage' or 'fixed', the campaign applies its own
     * discount directly at checkout — no code needed. 'none' preserves
     * the legacy "container-only" behavior (discount comes from attached
     * codes). Free courses are always skipped by the checkout guard.
     */
    discountType: varchar('discount_type', { length: 20 })
      .notNull()
      .default('none'),
    /** SAR (fixed) or 1..100 (percentage). NULL when discount_type='none'. */
    discountValue: numeric('discount_value', { precision: 10, scale: 2 }),
    /**
     * Which courses the direct campaign discount applies to.
     *   - `code_only`         → no direct discount (attached codes only)
     *   - `all_paid`          → every paid course
     *   - `by_delivery_type`  → paid courses matching scopeDeliveryTypes
     *   - `specific_courses`  → paid courses whose id is in scopeCourseIds
     */
    scope: varchar('scope', { length: 20 })
      .notNull()
      .default('code_only'),
    scopeDeliveryTypes: text('scope_delivery_types')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    scopeCourseIds: uuid('scope_course_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    /**
     * When true, a buyer can still enter a coupon on top of this
     * campaign's discount. Default false = mutually exclusive (checkout
     * hides the coupon input while the campaign discount is active).
     * Mirrors courses.sale_allows_coupon.
     */
    allowsCoupon: boolean('allows_coupon').notNull().default(false),
    /**
     * Origin trail — populated when the campaign row was minted by the
     * points system (redeeming a discount_coupon / fixed_discount_coupon
     * reward). Lets the finance dashboard render a "Points Reward" tab
     * on the coupon drawer instead of hiding the origin behind an opaque
     * `points-reward:<id>` sentinel in the legacy `discount_codes.campaign`
     * text column. NULL on every hand-crafted campaign.
     */
    sourceType: text('source_type'),
    sourceRewardId: uuid('source_reward_id'),
    sourceRedemptionId: uuid('source_redemption_id'),
    sourceUserId: uuid('source_user_id'),
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
    index('coupon_campaigns_bulk_batch_id_idx').on(table.bulkBatchId),
    index('coupon_campaigns_campaign_type_idx').on(table.campaignType),
    index('coupon_campaigns_source_reward_id_idx').on(table.sourceRewardId),
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
