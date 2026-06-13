import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { tickets } from './tickets';

// Phase 2 — hub-and-spoke collaboration. Tracks which department
// users have been looped into a ticket as INTERNAL collaborators.
// They only see + post on the internal channel (ticket_replies.is_internal);
// the requester never sees the collaborator list nor internal replies.
//
// Soft-delete via removed_at keeps the audit trail. Re-adding a
// previously removed user just resets removed_at back to NULL on the
// existing row (one row per (ticket, user)).

export const TICKET_COLLAB_DEPARTMENTS = {
  COURSE_MANAGER: 'course_manager',
  FINANCE: 'finance',
  ADMIN: 'admin',
  INSTRUCTOR: 'instructor',
  TA: 'ta',
  SUPERVISOR: 'supervisor',
} as const;

export type TicketCollabDepartment =
  (typeof TICKET_COLLAB_DEPARTMENTS)[keyof typeof TICKET_COLLAB_DEPARTMENTS];

export const ticketCollaborators = pgTable(
  'ticket_collaborators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    department: varchar('department', { length: 30 }).notNull(),
    addedBy: uuid('added_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    addedAt: timestamp('added_at').defaultNow().notNull(),
    removedAt: timestamp('removed_at'),
  },
  (table) => [
    uniqueIndex('ticket_collab_unique').on(table.ticketId, table.userId),
    index('ticket_collab_ticket_idx').on(table.ticketId),
    index('ticket_collab_user_idx').on(table.userId),
  ],
);

export const ticketCollaboratorsRelations = relations(
  ticketCollaborators,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [ticketCollaborators.ticketId],
      references: [tickets.id],
    }),
    user: one(users, {
      fields: [ticketCollaborators.userId],
      references: [users.id],
    }),
    addedByUser: one(users, {
      fields: [ticketCollaborators.addedBy],
      references: [users.id],
    }),
  }),
);

export type TicketCollaborator = typeof ticketCollaborators.$inferSelect;
export type NewTicketCollaborator = typeof ticketCollaborators.$inferInsert;
