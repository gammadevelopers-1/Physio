import {
  pgTable,
  uuid,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { tickets } from './tickets';
import { serviceStatusIncidents } from './service-status';

// ─── Ticket ↔ Incident join ───────────────────────────────────
//
// One row per (ticket, incident) link. Created when an agent links a
// ticket to an active incident via the right-rail widget. Unique so
// the same ticket can't be linked to the same incident twice. Both
// FKs cascade — if either side is gone the link is meaningless.

export const ticketIncidents = pgTable(
  'ticket_incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => serviceStatusIncidents.id, { onDelete: 'cascade' }),
    linkedAt: timestamp('linked_at').notNull().defaultNow(),
    linkedBy: uuid('linked_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('ticket_incidents_ticket_idx').on(table.ticketId),
    index('ticket_incidents_incident_idx').on(table.incidentId),
    unique('ticket_incidents_ticket_id_incident_id_unique').on(
      table.ticketId,
      table.incidentId,
    ),
  ],
);

export const ticketIncidentsRelations = relations(
  ticketIncidents,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [ticketIncidents.ticketId],
      references: [tickets.id],
    }),
    incident: one(serviceStatusIncidents, {
      fields: [ticketIncidents.incidentId],
      references: [serviceStatusIncidents.id],
    }),
  }),
);

export type TicketIncident = typeof ticketIncidents.$inferSelect;
export type NewTicketIncident = typeof ticketIncidents.$inferInsert;
