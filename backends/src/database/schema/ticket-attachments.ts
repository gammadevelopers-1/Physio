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
import { tickets, ticketReplies } from './tickets';

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
    // Optional pointer to a specific reply. When set, the attachment
    // belongs to that comment (staff uploads, learner replies-with-file
    // in the future). When null, it's the original ticket-level upload.
    replyId: uuid('reply_id').references(() => ticketReplies.id, {
      onDelete: 'cascade',
    }),
    url: varchar('url', { length: 500 }).notNull(),
    filename: varchar('filename', { length: 255 }),
    sizeBytes: integer('size_bytes').notNull().default(-1),
    mimeType: varchar('mime_type', { length: 100 }),
    uploadedBy: uuid('uploaded_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
    // Soft delete — removing an attachment leaves the row in place so
    // the version-history timeline can show "uploaded → removed".
    // Active attachments have both columns null. See migration 0065.
    removedAt: timestamp('removed_at'),
    removedBy: uuid('removed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    // Content fingerprint — populated at upload time. Used to flag
    // "same file uploaded again on this ticket" (informational only,
    // no enforcement). Nullable because legacy rows pre-date the
    // column and we don't backfill.
    sha256: varchar('sha256', { length: 64 }),
  },
  (table) => [
    index('ticket_attachments_ticket_idx').on(table.ticketId),
    index('ticket_attachments_reply_idx').on(table.replyId),
    uniqueIndex('ticket_attachments_ticket_url_uniq').on(
      table.ticketId,
      table.url,
    ),
    index('ticket_attachments_removed_at_idx').on(table.removedAt),
    index('ticket_attachments_sha256_idx').on(table.sha256),
  ],
);

export const ticketAttachmentsRelations = relations(
  ticketAttachments,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [ticketAttachments.ticketId],
      references: [tickets.id],
    }),
    reply: one(ticketReplies, {
      fields: [ticketAttachments.replyId],
      references: [ticketReplies.id],
    }),
    uploader: one(users, {
      fields: [ticketAttachments.uploadedBy],
      references: [users.id],
    }),
  }),
);

export type TicketAttachment = typeof ticketAttachments.$inferSelect;
export type NewTicketAttachment = typeof ticketAttachments.$inferInsert;
