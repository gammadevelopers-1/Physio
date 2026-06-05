import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
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
  },
  (table) => [
    uniqueIndex('ticket_tags_name_lower_idx').on(sql`LOWER(${table.name})`),
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
