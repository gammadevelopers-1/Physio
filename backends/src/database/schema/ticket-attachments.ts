import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { tickets } from './tickets';

// One row per attached file on a ticket. See migration 0054 — the old
// single `tickets.attachment_url` column stays for backward compat;
// all NEW attachments (single or multiple) flow through here.

export const ticketAttachments = pgTable(
  'ticket_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 500 }).notNull(),
    filename: varchar('filename', { length: 255 }),
    sizeBytes: integer('size_bytes').notNull().default(-1),
    mimeType: varchar('mime_type', { length: 100 }),
    uploadedBy: uuid('uploaded_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  },
  (table) => [
    index('ticket_attachments_ticket_idx').on(table.ticketId),
    uniqueIndex('ticket_attachments_ticket_url_uniq').on(
      table.ticketId,
      table.url,
    ),
  ],
);

export const ticketAttachmentsRelations = relations(
  ticketAttachments,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [ticketAttachments.ticketId],
      references: [tickets.id],
    }),
    uploader: one(users, {
      fields: [ticketAttachments.uploadedBy],
      references: [users.id],
    }),
  }),
);

export type TicketAttachment = typeof ticketAttachments.$inferSelect;
export type NewTicketAttachment = typeof ticketAttachments.$inferInsert;
