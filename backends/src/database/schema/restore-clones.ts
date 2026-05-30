import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { backups } from './backups';

/**
 * Tracking row for admin-created restore sandboxes (Phase 2D).
 *
 * Each row maps to one ephemeral Postgres database on the live Cloud
 * SQL instance, restored from a downloadable backup export. Sandboxes
 * are read-only workspaces — the admin connects via Cloud SQL Studio
 * (or psql) to extract specific rows, then manually applies the fix
 * to the live database. The sandbox auto-drops past `expiresAt` (cron
 * runs hourly) so no copy of production data sits around indefinitely.
 *
 *   status flow:
 *     creating  → database CREATE call issued, waiting for ACK
 *     importing → SQL import job started, polling for completion
 *     ready     → admin can connect
 *     failed    → create or import errored; `error` populated
 *     dropped   → admin or cron dropped the database
 *     expired   → cron dropped the database past expiresAt
 */
export const restoreClones = pgTable(
  'restore_clones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    backupId: uuid('backup_id').references(() => backups.id, {
      onDelete: 'set null',
    }),
    // The actual Postgres database name on the Cloud SQL instance, e.g.
    // 'pgrestore_20260530_142233_abc123'. Used in connection strings
    // and in the DROP/IMPORT REST calls.
    dbName: varchar('db_name', { length: 120 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('creating'),
    // Cloud SQL long-running operation name for the import; polled
    // by syncRunning() the same way backup exports are.
    sqlOperationName: varchar('sql_operation_name', { length: 200 }),
    error: text('error'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    // When the auto-purge cron will drop this clone. Capped at 48h
    // from creation at the service layer; extend bumps by 24h.
    expiresAt: timestamp('expires_at').notNull(),
    droppedAt: timestamp('dropped_at'),
    // Null when the cron dropped it on expiry; populated when the
    // admin force-dropped via UI.
    droppedBy: uuid('dropped_by').references(() => users.id),
  },
  (table) => [
    index('restore_clones_status_idx').on(table.status),
    index('restore_clones_expires_at_idx').on(table.expiresAt),
    index('restore_clones_created_by_idx').on(table.createdBy),
  ],
);

export const restoreClonesRelations = relations(restoreClones, ({ one }) => ({
  backup: one(backups, {
    fields: [restoreClones.backupId],
    references: [backups.id],
  }),
  creator: one(users, {
    fields: [restoreClones.createdBy],
    references: [users.id],
  }),
  dropper: one(users, {
    fields: [restoreClones.droppedBy],
    references: [users.id],
  }),
}));

export type RestoreClone = typeof restoreClones.$inferSelect;
export type NewRestoreClone = typeof restoreClones.$inferInsert;

export const RESTORE_CLONE_STATUS = {
  CREATING: 'creating',
  IMPORTING: 'importing',
  READY: 'ready',
  FAILED: 'failed',
  DROPPED: 'dropped',
  EXPIRED: 'expired',
} as const;

export type RestoreCloneStatus =
  (typeof RESTORE_CLONE_STATUS)[keyof typeof RESTORE_CLONE_STATUS];

/** Hard ceilings enforced at the service layer. */
export const RESTORE_CLONE_LIMITS = {
  /** Default lifetime when admin creates a new sandbox. */
  DEFAULT_LIFETIME_HOURS: 24,
  /** Hard maximum lifetime — even with extensions. */
  MAX_LIFETIME_HOURS: 48,
  /** How many simultaneously-live sandboxes are allowed (cost control). */
  MAX_CONCURRENT: 3,
} as const;
