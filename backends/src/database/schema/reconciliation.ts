import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  jsonb,
  text,
  index,
  AnyPgColumn,
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
    // Denormalized pointer to the latest escalation. Source of truth is
    // the FK on reconciliation_escalations.findingId.
    escalationId: uuid('escalation_id').references(
      (): AnyPgColumn => reconciliationEscalations.id,
      { onDelete: 'set null' },
    ),
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

/**
 * Escalation of a reconciliation finding from finance → admin. See
 * migration 0088 for source-of-truth on the CHECK constraints + indexes
 * (notably the partial unique index that enforces "one active escalation
 * per finding"). Drizzle mirrors but does NOT re-enforce these here.
 */
export const reconciliationEscalations = pgTable(
  'reconciliation_escalations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    findingId: uuid('finding_id')
      .notNull()
      .references(() => reconciliationFindings.id, { onDelete: 'cascade' }),
    escalatedBy: uuid('escalated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    escalatedAt: timestamp('escalated_at').defaultNow().notNull(),
    escalationNote: text('escalation_note').notNull(),
    proposedAction: varchar('proposed_action', { length: 32 }).notNull(),
    urgency: varchar('urgency', { length: 16 }).notNull().default('normal'),

    status: varchar('status', { length: 16 }).notNull().default('pending'),
    claimedBy: uuid('claimed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    claimedAt: timestamp('claimed_at'),

    actionTaken: varchar('action_taken', { length: 32 }),
    resolutionNote: text('resolution_note'),
    resolvedBy: uuid('resolved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at'),

    linkedEntityType: varchar('linked_entity_type', { length: 32 }),
    linkedEntityId: uuid('linked_entity_id'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('reconciliation_escalations_status_idx').on(table.status),
    index('reconciliation_escalations_escalated_by_idx').on(table.escalatedBy),
    index('reconciliation_escalations_claimed_by_idx').on(table.claimedBy),
    index('reconciliation_escalations_finding_id_idx').on(table.findingId),
    index('reconciliation_escalations_escalated_at_idx').on(table.escalatedAt),
  ],
);

export const reconciliationSettings = pgTable('reconciliation_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, {
    onDelete: 'set null',
  }),
});

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
  ESCALATED: 'escalated',
} as const;

export const ESCALATION_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  DECLINED: 'declined',
  SENT_BACK: 'sent_back',
} as const;

export const ESCALATION_URGENCY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
} as const;

export const ESCALATION_PROPOSED_ACTION = {
  ENROLL: 'enroll',
  REFUND: 'refund',
  INVESTIGATE: 'investigate',
  OTHER: 'other',
  SYSTEM_INFERRED: 'system_inferred',
} as const;

export const ESCALATION_ACTION_TAKEN = {
  ENROLLED: 'enrolled',
  REFUNDED: 'refunded',
  NO_ACTION: 'no_action',
  SENT_BACK: 'sent_back',
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
export type ReconciliationEscalation = typeof reconciliationEscalations.$inferSelect;
export type NewReconciliationEscalation = typeof reconciliationEscalations.$inferInsert;
export type ReconciliationSetting = typeof reconciliationSettings.$inferSelect;
