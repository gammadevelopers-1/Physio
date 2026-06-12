import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
  boolean,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { tickets } from './tickets';

// ─── Tag registry ─────────────────────────────────────────
//
// One row per tag in the admin-curated taxonomy. Names are stored
// case-preserving but uniqueness is enforced on LOWER(name) (migration
// 0051) so "Refund" and "refund" collapse into a single tag.

export const ticketTags = pgTable(
  'ticket_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 50 }).notNull(),
    color: varchar('color', { length: 9 }).notNull().default('#E5E7EB'),
    description: varchar('description', { length: 200 }),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    // Soft archive — hides the tag from picker + auto-apply matcher.
    // Existing assignments stay so historical filtering keeps working.
    archivedAt: timestamp('archived_at'),
  },
  (table) => [
    uniqueIndex('ticket_tags_name_lower_idx').on(sql`LOWER(${table.name})`),
  ],
);

// ─── Auto-apply rules ─────────────────────────────────────
//
// One row per (tag, pattern) trigger. The rule engine matches
// `pattern` against the ticket's subject and/or description on
// creation and auto-attaches the tag when any pattern hits. Match is
// case-insensitive substring (no regex — admins shouldn't be able to
// hang the queue with a runaway expression).

export const ticketTagRules = pgTable(
  'ticket_tag_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => ticketTags.id, { onDelete: 'cascade' }),
    pattern: varchar('pattern', { length: 200 }).notNull(),
    matchScope: varchar('match_scope', { length: 20 })
      .notNull()
      .default('both'),
    enabled: boolean('enabled').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('ticket_tag_rules_enabled_idx').on(table.tagId),
    check(
      'tag_rule_scope_check',
      sql`${table.matchScope} IN ('subject', 'description', 'both')`,
    ),
    check(
      'tag_rule_pattern_not_blank',
      sql`length(trim(${table.pattern})) > 0`,
    ),
  ],
);

// ─── Junction ──────────────────────────────────────────────
//
// (ticket_id, tag_id) composite PK — natural key, no synthetic id.
// `assigned_by` is denormalized provenance so reporting can credit the
// staff member without joining against the action log.

export const ticketTagAssignments = pgTable(
  'ticket_tag_assignments',
  {
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => ticketTags.id, { onDelete: 'cascade' }),
    assignedBy: uuid('assigned_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.ticketId, table.tagId] }),
    index('ticket_tag_assignments_tag_idx').on(table.tagId),
  ],
);

export const ticketTagsRelations = relations(ticketTags, ({ many }) => ({
  assignments: many(ticketTagAssignments),
}));

export const ticketTagAssignmentsRelations = relations(
  ticketTagAssignments,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [ticketTagAssignments.ticketId],
      references: [tickets.id],
    }),
    tag: one(ticketTags, {
      fields: [ticketTagAssignments.tagId],
      references: [ticketTags.id],
    }),
    assignedByUser: one(users, {
      fields: [ticketTagAssignments.assignedBy],
      references: [users.id],
    }),
  }),
);

export type TicketTag = typeof ticketTags.$inferSelect;
export type NewTicketTag = typeof ticketTags.$inferInsert;
export type TicketTagAssignment = typeof ticketTagAssignments.$inferSelect;
export type NewTicketTagAssignment = typeof ticketTagAssignments.$inferInsert;
export type TicketTagRule = typeof ticketTagRules.$inferSelect;
export type NewTicketTagRule = typeof ticketTagRules.$inferInsert;

export const TAG_RULE_SCOPES = ['subject', 'description', 'both'] as const;
export type TagRuleScope = (typeof TAG_RULE_SCOPES)[number];
