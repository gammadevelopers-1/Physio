import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { tickets } from './tickets';

// ─── Attachment download log ──────────────────────────────
//
// Recorded for every fetch of a ticket attachment by a staff member.
// Students fetching their own files are out of scope — this is for
// compliance and forensic review of staff access. See migration 0053.

export const attachmentDownloadEvents = pgTable(
  'attachment_download_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    attachmentUrl: varchar('attachment_url', { length: 500 }).notNull(),
    downloadedBy: uuid('downloaded_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 500 }),
    downloadedAt: timestamp('downloaded_at').notNull().defaultNow(),
  },
  (table) => [
    index('attachment_download_events_ticket_idx').on(table.ticketId),
    index('attachment_download_events_downloaded_at_idx').on(
      table.downloadedAt,
    ),
  ],
);

export const attachmentDownloadEventsRelations = relations(
  attachmentDownloadEvents,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [attachmentDownloadEvents.ticketId],
      references: [tickets.id],
    }),
    downloader: one(users, {
      fields: [attachmentDownloadEvents.downloadedBy],
      references: [users.id],
    }),
  }),
);

// ─── Attachment scan results ──────────────────────────────
//
// Pluggable scanner record. We're not opinionated about which
// scanner runs — Cloud Storage, third-party, manual upload — only
// that whatever runs writes a row here. The (ticket_id, attachment_url)
// unique index lets the scanner upsert a row safely.

export const ticketAttachmentScans = pgTable(
  'ticket_attachment_scans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    attachmentUrl: varchar('attachment_url', { length: 500 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    details: varchar('details', { length: 500 }),
    scanner: varchar('scanner', { length: 50 }),
    scannedAt: timestamp('scanned_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('ticket_attachment_scans_ticket_idx').on(table.ticketId),
    uniqueIndex('ticket_attachment_scans_ticket_url_uniq').on(
      table.ticketId,
      table.attachmentUrl,
    ),
  ],
);

export const ticketAttachmentScansRelations = relations(
  ticketAttachmentScans,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [ticketAttachmentScans.ticketId],
      references: [tickets.id],
    }),
  }),
);

export type AttachmentDownloadEvent =
  typeof attachmentDownloadEvents.$inferSelect;
export type NewAttachmentDownloadEvent =
  typeof attachmentDownloadEvents.$inferInsert;
export type TicketAttachmentScan = typeof ticketAttachmentScans.$inferSelect;
export type NewTicketAttachmentScan =
  typeof ticketAttachmentScans.$inferInsert;
