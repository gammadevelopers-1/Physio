import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { tickets } from './tickets';
import { users } from './users';

// Hold-approval requests. Agents submit; supervisors / admins decide.
// See migration 0057 for the rationale + the partial unique index that
// enforces one pending request per ticket.
export const ticketHoldRequests = pgTable(
  'ticket_hold_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id),
    reason: varchar('reason', { length: 50 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    decidedBy: uuid('decided_by').references(() => users.id),
    decidedAt: timestamp('decided_at'),
    decisionNote: text('decision_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    check(
      'hold_req_status_check',
      sql`${table.status} IN ('pending', 'approved', 'rejected', 'cancelled')`,
    ),
    index('hold_req_ticket_status_idx').on(table.ticketId, table.status),
    uniqueIndex('hold_req_one_pending_per_ticket')
      .on(table.ticketId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export const ticketHoldRequestsRelations = relations(
  ticketHoldRequests,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [ticketHoldRequests.ticketId],
      references: [tickets.id],
    }),
    requester: one(users, {
      fields: [ticketHoldRequests.requestedBy],
      references: [users.id],
      relationName: 'holdRequester',
    }),
    decider: one(users, {
      fields: [ticketHoldRequests.decidedBy],
      references: [users.id],
      relationName: 'holdDecider',
    }),
  }),
);

export type TicketHoldRequest = typeof ticketHoldRequests.$inferSelect;
export type NewTicketHoldRequest = typeof ticketHoldRequests.$inferInsert;

export const HOLD_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

export const HOLD_REASONS = [
  'waiting for student response',
  'waiting for third party',
  'waiting for internal team',
  'pending investigation',
  'other',
] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];
