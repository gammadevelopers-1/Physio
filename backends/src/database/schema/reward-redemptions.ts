import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  jsonb,
  text,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { rewardCatalog } from './reward-catalog';
import { pointTransactions } from './point-transactions';

/**
 * reward_redemptions — one row per user's attempt to redeem a reward.
 *
 * Lifecycle:
 *   pending    debit posted, awaiting fulfillment (mostly for `other` type,
 *              or for coupon rewards while the discount code row is created)
 *   fulfilled  saga completed successfully — fulfillment_payload holds the
 *              concrete artifact (discount code id, enrollment id, ...)
 *   failed     saga aborted; points are credited back atomically and the row
 *              stays as an audit trail
 *   reversed   admin-triggered reversal after the fact (points credited back)
 */
export const REWARD_REDEMPTION_STATUSES = [
  'pending',
  'fulfilled',
  'failed',
  'reversed',
] as const;
export type RewardRedemptionStatus = (typeof REWARD_REDEMPTION_STATUSES)[number];

export const rewardRedemptions = pgTable(
  'reward_redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rewardId: uuid('reward_id')
      .notNull()
      .references(() => rewardCatalog.id, { onDelete: 'restrict' }),
    pointsSpent: integer('points_spent').notNull(),
    status: varchar('status', { length: 20 })
      .$type<RewardRedemptionStatus>()
      .notNull()
      .default('pending'),
    fulfillmentPayload: jsonb('fulfillment_payload')
      .notNull()
      .default(sql`'{}'::jsonb`),
    /**
     * Free-form artifact attached at (or after) fulfillment. Phase 1's
     * history page reads whatever is here; Phase 2's admin "Other reward
     * workflow" writes it — text codes, external links, tracking numbers,
     * etc. Kept as jsonb so the shape can evolve without a migration.
     */
    fulfillmentArtifact: jsonb('fulfillment_artifact').$type<{
      kind?: string;
      value?: string;
      meta?: Record<string, unknown>;
    } | null>(),
    ledgerTxId: uuid('ledger_tx_id').references(() => pointTransactions.id, {
      onDelete: 'set null',
    }),
    failureReason: text('failure_reason'),
    redeemedAt: timestamp('redeemed_at').notNull().defaultNow(),
    fulfilledAt: timestamp('fulfilled_at'),
    expiresAt: timestamp('expires_at'),
    reversedAt: timestamp('reversed_at'),
    reversedBy: uuid('reversed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    reversalReason: text('reversal_reason'),
  },
  (t) => [
    index('reward_redemptions_user_id_idx').on(t.userId),
    index('reward_redemptions_reward_id_idx').on(t.rewardId),
    index('reward_redemptions_status_idx').on(t.status),
    index('reward_redemptions_redeemed_at_idx').on(t.redeemedAt),
    check(
      'reward_redemptions_status_check',
      sql`${t.status} IN ('pending','fulfilled','failed','reversed')`,
    ),
    check('reward_redemptions_points_positive', sql`${t.pointsSpent} > 0`),
  ],
);

export const rewardRedemptionsRelations = relations(
  rewardRedemptions,
  ({ one }) => ({
    user: one(users, {
      fields: [rewardRedemptions.userId],
      references: [users.id],
    }),
    reward: one(rewardCatalog, {
      fields: [rewardRedemptions.rewardId],
      references: [rewardCatalog.id],
    }),
    ledgerTx: one(pointTransactions, {
      fields: [rewardRedemptions.ledgerTxId],
      references: [pointTransactions.id],
    }),
  }),
);

export type RewardRedemption = typeof rewardRedemptions.$inferSelect;
export type NewRewardRedemption = typeof rewardRedemptions.$inferInsert;
