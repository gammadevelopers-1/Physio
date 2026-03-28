import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  json,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { tickets } from './tickets';

// ─── SLA Policies ──────────────────────────────────────────

export const slaPolicies = pgTable(
  'sla_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    priority: varchar('priority', { length: 10 }).notNull().unique(),
    frtMinutes: integer('frt_minutes').notNull(),
    ttrMinutes: integer('ttr_minutes').notNull(),
    escalateAfterMinutes: integer('escalate_after_minutes').notNull(),
    escalateToRole: varchar('escalate_to_role', { length: 50 }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    check(
      'sla_priority_check',
      sql`${table.priority} IN ('high', 'medium', 'low')`,
    ),
  ],
);

// ─── SLA Events ──────────────────────────────────────────

export const slaEvents = pgTable(
  'sla_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 30 }).notNull(),
    triggeredAt: timestamp('triggered_at').defaultNow().notNull(),
    notifiedUserIds: json('notified_user_ids').$type<string[]>(),
    resolvedWithinSla: boolean('resolved_within_sla'),
  },
  (table) => [
    index('sla_events_ticket_id_idx').on(table.ticketId),
    index('sla_events_event_type_idx').on(table.eventType),
    check(
      'sla_event_type_check',
      sql`${table.eventType} IN ('frt_breach', 'ttr_breach', 'escalation_triggered', 'resolved_within_sla')`,
    ),
  ],
);

// ─── Relations ──────────────────────────────────────────

export const slaEventsRelations = relations(slaEvents, ({ one }) => ({
  ticket: one(tickets, {
    fields: [slaEvents.ticketId],
    references: [tickets.id],
  }),
}));

// ─── Types ──────────────────────────────────────────

export type SlaPolicy = typeof slaPolicies.$inferSelect;
export type NewSlaPolicy = typeof slaPolicies.$inferInsert;
export type SlaEvent = typeof slaEvents.$inferSelect;
export type NewSlaEvent = typeof slaEvents.$inferInsert;

export const SLA_EVENT_TYPES = {
  FRT_BREACH: 'frt_breach',
  TTR_BREACH: 'ttr_breach',
  ESCALATION_TRIGGERED: 'escalation_triggered',
  RESOLVED_WITHIN_SLA: 'resolved_within_sla',
  FRT_WARNING_75: 'frt_warning_75',
  PRIORITY_ESCALATED: 'priority_escalated',
  FRT_BREACH_REASSIGNED: 'frt_breach_reassigned',
} as const;
