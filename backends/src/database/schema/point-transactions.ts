import {
  pgTable,
  uuid,
  integer,
  timestamp,
  varchar,
  index,
  unique,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { pointRules } from './point-rules';

/**
 * point_transactions — append-only ledger. Source of truth for balances.
 *
 * Balance = SUM(delta) of rows where (expires_at IS NULL OR expires_at > NOW())
 * for a given user_id. Stripe-style: never UPDATE/DELETE existing rows; reversals
 * insert compensating rows.
 *
 * The idempotency_key UNIQUE constraint is the central correctness invariant:
 * the same earn event (e.g. course completion for an enrollment) cannot be
 * processed twice, even if the cron retries or the manual completion endpoint
 * fires after the cron already ran. The DB rejects duplicate keys.
 *
 * Reasons follow a "namespace:action" convention:
 *  - 'earn:signup', 'earn:course_completed', 'earn:review_approved'
 *  - 'redeem:hold', 'redeem:committed', 'redeem:released'
 *  - 'reverse:refund'
 *  - 'admin:grant', 'admin:deduct'
 *  - 'system:expire'
 */
export const pointTransactions = pgTable(
  'point_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    reason: varchar('reason', { length: 50 }).notNull(),
    ruleId: uuid('rule_id').references(() => pointRules.id),
    sourceEntityType: varchar('source_entity_type', { length: 50 }),
    sourceEntityId: uuid('source_entity_id'),
    idempotencyKey: varchar('idempotency_key', { length: 120 }),
    expiresAt: timestamp('expires_at'),
    metadata: jsonb('metadata'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('point_transactions_idempotency_key_unique').on(table.idempotencyKey),
    index('point_transactions_user_id_idx').on(table.userId),
    index('point_transactions_user_created_idx').on(
      table.userId,
      table.createdAt,
    ),
    index('point_transactions_expires_at_idx').on(table.expiresAt),
    index('point_transactions_rule_id_idx').on(table.ruleId),
    index('point_transactions_source_idx').on(
      table.sourceEntityType,
      table.sourceEntityId,
    ),
  ],
);

export const pointTransactionsRelations = relations(
  pointTransactions,
  ({ one }) => ({
    user: one(users, {
      fields: [pointTransactions.userId],
      references: [users.id],
    }),
    rule: one(pointRules, {
      fields: [pointTransactions.ruleId],
      references: [pointRules.id],
    }),
    createdByUser: one(users, {
      fields: [pointTransactions.createdBy],
      references: [users.id],
    }),
  }),
);

export type PointTransaction = typeof pointTransactions.$inferSelect;
export type NewPointTransaction = typeof pointTransactions.$inferInsert;
