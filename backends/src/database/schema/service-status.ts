import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';

// ─── Service-status components ─────────────────────────────────
//
// One row per public-facing component shown on /status. Seeded with
// the four named at platform launch (platform / webinar / email /
// payment); admins can add more from the admin panel later. `key`
// is the stable identifier the public page reads.

export const serviceStatusComponents = pgTable(
  'service_status_components',
  {
    key: varchar('key', { length: 50 }).primaryKey(),
    nameEn: varchar('name_en', { length: 100 }).notNull(),
    nameAr: varchar('name_ar', { length: 100 }),
    descriptionEn: text('description_en'),
    descriptionAr: text('description_ar'),
    // Legacy column — preserved so the existing public endpoint
    // can still read a "current state" without joining. The
    // auto-cron + admin override paths both write here as the
    // resolved effective status, so it's always consistent with
    // getEffectiveStatus(component).
    currentStatus: varchar('current_status', { length: 30 })
      .notNull()
      .default('operational'),
    currentMessageEn: text('current_message_en'),
    currentMessageAr: text('current_message_ar'),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    updatedBy: uuid('updated_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    // Auto-detection layer (migration 0063). When checkType is not
    // 'manual', a cron job runs the corresponding check every few
    // minutes and writes auto_status. The public-facing status is
    // (manualOverride ?? autoStatus ?? 'operational').
    checkType: varchar('check_type', { length: 30 })
      .notNull()
      .default('manual'),
    checkConfig: jsonb('check_config').$type<Record<string, unknown>>(),
    autoStatus: varchar('auto_status', { length: 30 }),
    autoCheckedAt: timestamp('auto_checked_at'),
    autoError: text('auto_error'),
    manualOverrideStatus: varchar('manual_override_status', { length: 30 }),
    manualOverrideSetAt: timestamp('manual_override_set_at'),
    manualOverrideSetBy: uuid('manual_override_set_by').references(
      () => users.id,
      { onDelete: 'set null' },
    ),
  },
  (table) => [
    index('service_status_components_display_order_idx').on(table.displayOrder),
    check(
      'service_status_components_status_check',
      sql`${table.currentStatus} IN ('operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance')`,
    ),
    check(
      'service_status_components_check_type_check',
      sql`${table.checkType} IN ('manual', 'internal_db', 'statuspage')`,
    ),
  ],
);

// ─── Incidents ──────────────────────────────────────────────────
//
// affectedComponents is a Postgres text[] of component keys — keep
// it loose because one incident may span multiple components and
// requiring a junction table would be overkill at v1.

export const serviceStatusIncidents = pgTable(
  'service_status_incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    titleEn: varchar('title_en', { length: 200 }).notNull(),
    titleAr: varchar('title_ar', { length: 200 }),
    affectedComponents: text('affected_components')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    currentStatus: varchar('current_status', { length: 30 })
      .notNull()
      .default('investigating'),
    severity: varchar('severity', { length: 20 }).notNull().default('minor'),
    // 'internal' (ops/dev only) vs 'end_users' (shown in the
    // cross-dashboard banner + triggers notifications). Default
    // 'internal' so the existing manual incident flow doesn't
    // accidentally fire a banner.
    audience: varchar('audience', { length: 20 })
      .notNull()
      .default('internal'),
    // Which role dashboards see the banner / get notified. Postgres
    // text[] of role names ('STUDENT', 'INSTRUCTOR', 'MANAGER', 'TA',
    // 'FINANCE'). Admin + Support never appear here.
    affectedRoles: text('affected_roles')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // Post-mortem fields, edited from the admin tab once an incident
    // is resolved. Optional — many minor incidents won't need them.
    rootCause: text('root_cause'),
    correctiveActions: text('corrective_actions'),
    // Captured when the admin resolves an incident with linked
    // tickets — drives what we do with those tickets:
    //   soft_resolve: system reply + transition to ON_HOLD
    //   auto_close:   system reply + transition to RESOLVED
    //   leave_open:   system reply only
    linkedResolutionStrategy: varchar('linked_resolution_strategy', {
      length: 20,
    }),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('service_status_incidents_resolved_at_idx').on(table.resolvedAt),
    index('service_status_incidents_started_at_idx').on(table.startedAt),
    check(
      'service_status_incidents_status_check',
      sql`${table.currentStatus} IN ('investigating', 'identified', 'monitoring', 'resolved')`,
    ),
    check(
      'service_status_incidents_severity_check',
      sql`${table.severity} IN ('minor', 'major', 'critical')`,
    ),
    check(
      'service_status_incidents_audience_check',
      sql`${table.audience} IN ('internal', 'end_users')`,
    ),
    check(
      'service_status_incidents_strategy_check',
      sql`${table.linkedResolutionStrategy} IS NULL OR ${table.linkedResolutionStrategy} IN ('soft_resolve', 'auto_close', 'leave_open')`,
    ),
  ],
);

// ─── Incident timeline updates ──────────────────────────────────
//
// One row per timeline message. The latest update's `status` is the
// incident's current status — we keep the per-update status here
// rather than only overwriting incident.currentStatus so the
// timeline is immutable and reads chronologically.

export const serviceStatusIncidentUpdates = pgTable(
  'service_status_incident_updates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => serviceStatusIncidents.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 30 }).notNull(),
    messageEn: text('message_en').notNull(),
    messageAr: text('message_ar'),
    postedAt: timestamp('posted_at').notNull().defaultNow(),
    postedBy: uuid('posted_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('service_status_incident_updates_incident_id_idx').on(table.incidentId),
    index('service_status_incident_updates_posted_at_idx').on(table.postedAt),
    check(
      'service_status_incident_updates_status_check',
      sql`${table.status} IN ('investigating', 'identified', 'monitoring', 'resolved')`,
    ),
  ],
);

// ─── Relations ──────────────────────────────────────────────────

export const serviceStatusIncidentsRelations = relations(
  serviceStatusIncidents,
  ({ many }) => ({
    updates: many(serviceStatusIncidentUpdates),
  }),
);

export const serviceStatusIncidentUpdatesRelations = relations(
  serviceStatusIncidentUpdates,
  ({ one }) => ({
    incident: one(serviceStatusIncidents, {
      fields: [serviceStatusIncidentUpdates.incidentId],
      references: [serviceStatusIncidents.id],
    }),
  }),
);

// ─── Types ──────────────────────────────────────────────────────

export type ServiceStatusComponent =
  typeof serviceStatusComponents.$inferSelect;
export type NewServiceStatusComponent =
  typeof serviceStatusComponents.$inferInsert;

export type ServiceStatusIncident =
  typeof serviceStatusIncidents.$inferSelect;
export type NewServiceStatusIncident =
  typeof serviceStatusIncidents.$inferInsert;

export type ServiceStatusIncidentUpdate =
  typeof serviceStatusIncidentUpdates.$inferSelect;
export type NewServiceStatusIncidentUpdate =
  typeof serviceStatusIncidentUpdates.$inferInsert;

export const COMPONENT_STATUS = {
  OPERATIONAL: 'operational',
  DEGRADED: 'degraded',
  PARTIAL_OUTAGE: 'partial_outage',
  MAJOR_OUTAGE: 'major_outage',
  MAINTENANCE: 'maintenance',
} as const;

export type ComponentStatus =
  (typeof COMPONENT_STATUS)[keyof typeof COMPONENT_STATUS];

export const INCIDENT_STATUS = {
  INVESTIGATING: 'investigating',
  IDENTIFIED: 'identified',
  MONITORING: 'monitoring',
  RESOLVED: 'resolved',
} as const;

export type IncidentStatus =
  (typeof INCIDENT_STATUS)[keyof typeof INCIDENT_STATUS];

export const INCIDENT_SEVERITY = {
  MINOR: 'minor',
  MAJOR: 'major',
  CRITICAL: 'critical',
} as const;

export type IncidentSeverity =
  (typeof INCIDENT_SEVERITY)[keyof typeof INCIDENT_SEVERITY];

export const INCIDENT_AUDIENCE = {
  INTERNAL: 'internal',
  END_USERS: 'end_users',
} as const;

export type IncidentAudience =
  (typeof INCIDENT_AUDIENCE)[keyof typeof INCIDENT_AUDIENCE];

export const INCIDENT_LINKED_RESOLUTION_STRATEGY = {
  SOFT_RESOLVE: 'soft_resolve',
  AUTO_CLOSE: 'auto_close',
  LEAVE_OPEN: 'leave_open',
} as const;

export type IncidentLinkedResolutionStrategy =
  (typeof INCIDENT_LINKED_RESOLUTION_STRATEGY)[keyof typeof INCIDENT_LINKED_RESOLUTION_STRATEGY];

// Roles that can appear in service_status_incidents.affected_roles —
// the dashboards that show the cross-dashboard banner. Admin and
// Support are excluded by design (they manage the incident).
export const INCIDENT_AFFECTED_ROLES = [
  'STUDENT',
  'INSTRUCTOR',
  'MANAGER',
  'TEACHING_ASSISTANT',
  'FINANCE',
] as const;

export type IncidentAffectedRole = (typeof INCIDENT_AFFECTED_ROLES)[number];
