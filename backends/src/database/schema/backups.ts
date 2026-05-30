import {
  pgTable,
  uuid,
  varchar,
  text,
  bigint,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

/**
 * Tracking row for admin-initiated backups. This does NOT replace Cloud
 * SQL's own automated daily backups + PITR (those are managed at the
 * infra layer) — it records the on-demand operations triggered from the
 * dashboard so the UI can show history, status, and download links.
 *
 *   mode = 'snapshot' → Cloud SQL native backup run (a restore point,
 *                        not a downloadable file)
 *   mode = 'export'   → SQL dump written to the backups GCS bucket and
 *                        downloadable via a signed URL
 */
export const backups = pgTable(
  'backups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 20 }).notNull().default('database'), // 'database' | 'files'
    mode: varchar('mode', { length: 20 }).notNull().default('export'), // 'snapshot' | 'export'
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | running | completed | failed
    gcsBucket: varchar('gcs_bucket', { length: 120 }),
    gcsObject: varchar('gcs_object', { length: 500 }),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    // Cloud SQL long-running operation name, used to poll for completion.
    operationName: varchar('operation_name', { length: 200 }),
    error: text('error'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    index('backups_status_idx').on(table.status),
    index('backups_created_at_idx').on(table.createdAt),
  ],
);

export const backupsRelations = relations(backups, ({ one }) => ({
  creator: one(users, {
    fields: [backups.createdBy],
    references: [users.id],
  }),
}));

export type Backup = typeof backups.$inferSelect;
export type NewBackup = typeof backups.$inferInsert;
