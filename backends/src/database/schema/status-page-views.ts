import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { serviceStatusIncidents } from './service-status';

// ─── Status page view events ────────────────────────────────
//
// Lightweight tracking for public /status visits. Cookie-deduped
// server-side (30 min window). No PII — only SHA-256 hashes.

export const statusPageViewEvents = pgTable(
  'status_page_view_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Null for general /status views; set for specific incident reads.
    incidentId: uuid('incident_id').references(
      () => serviceStatusIncidents.id,
      { onDelete: 'set null' },
    ),
    viewedAt: timestamp('viewed_at').notNull().defaultNow(),
    ipHash: varchar('ip_hash', { length: 64 }),
    sessionHash: varchar('session_hash', { length: 64 }),
  },
  (table) => [
    index('status_view_viewed_at_idx').on(table.viewedAt),
    index('status_view_incident_idx').on(table.incidentId),
    index('status_view_dedup_idx').on(table.sessionHash, table.viewedAt),
  ],
);

export type StatusPageViewEvent = typeof statusPageViewEvents.$inferSelect;
export type NewStatusPageViewEvent =
  typeof statusPageViewEvents.$inferInsert;
