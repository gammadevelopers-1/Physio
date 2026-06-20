import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  jsonb,
  text,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { payments } from './payments';

/**
 * Append-only log of drift detected between our payments table and the
 * gateways' own records, populated by the reconciliation scan. See
 * migration 0086 for the source of truth on the CHECK constraints and
 * indexes (Drizzle schema mirrors but does NOT re-enforce them here).
 */
export const reconciliationFindings = pgTable(
  'reconciliation_findings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scanRunId: uuid('scan_run_id').notNull(),
    gateway: varchar('gateway', { length: 20 }).notNull(),
    driftType: varchar('drift_type', { length: 32 }).notNull(),
    paymentId: uuid('payment_id').references(() => payments.id, {
      onDelete: 'set null',
    }),
    gatewayChargeId: varchar('gateway_charge_id', { length: 255 }),
    ourValue: jsonb('our_value'),
    gatewayValue: jsonb('gateway_value'),
    status: varchar('status', { length: 16 }).notNull().default('unresolved'),
    resolutionNote: text('resolution_note'),
    resolvedBy: uuid('resolved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('reconciliation_findings_status_idx').on(table.status),
    index('reconciliation_findings_gateway_idx').on(table.gateway),
    index('reconciliation_findings_payment_id_idx').on(table.paymentId),
    index('reconciliation_findings_scan_run_id_idx').on(table.scanRunId),
  ],
);

export const reconciliationScans = pgTable(
  'reconciliation_scans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gateway: varchar('gateway', { length: 20 }).notNull(),
    fromDate: timestamp('from_date').notNull(),
    toDate: timestamp('to_date').notNull(),
    status: varchar('status', { length: 16 }).notNull().default('running'),
    recordsScanned: integer('records_scanned').notNull().default(0),
    driftsFound: integer('drifts_found').notNull().default(0),
    triggeredBy: uuid('triggered_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    finishedAt: timestamp('finished_at'),
    durationMs: integer('duration_ms'),
    errorMessage: text('error_message'),
  },
  (table) => [
    index('reconciliation_scans_started_idx').on(table.startedAt),
    index('reconciliation_scans_gateway_idx').on(table.gateway),
  ],
);

export const RECONCILIATION_DRIFT_TYPE = {
  MISSING_LOCAL: 'missing_local',
  MISSING_GATEWAY: 'missing_gateway',
  AMOUNT_MISMATCH: 'amount_mismatch',
  STATUS_MISMATCH: 'status_mismatch',
  STUCK_PENDING: 'stuck_pending',
  STUCK_APPROVAL: 'stuck_approval',
  ORPHAN_RECEIPT: 'orphan_receipt',
  PAID_NO_RECEIPT: 'paid_no_receipt',
} as const;

export const RECONCILIATION_STATUS = {
  UNRESOLVED: 'unresolved',
  RESOLVED: 'resolved',
  IGNORED: 'ignored',
} as const;

export const RECONCILIATION_SCAN_STATUS = {
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
} as const;

export type ReconciliationFinding = typeof reconciliationFindings.$inferSelect;
export type NewReconciliationFinding = typeof reconciliationFindings.$inferInsert;
export type ReconciliationScan = typeof reconciliationScans.$inferSelect;
export type NewReconciliationScan = typeof reconciliationScans.$inferInsert;
