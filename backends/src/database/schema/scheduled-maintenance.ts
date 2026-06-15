import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

// ─── Scheduled maintenance windows ─────────────────────────────
//
// Admin schedules a planned maintenance window in advance. A cron
// flips system_settings.maintenance.enabled ON at start_at and OFF
// at end_at, plus fires pre-notification fan-out so end users see
// it coming.

export const scheduledMaintenanceWindows = pgTable(
  'scheduled_maintenance_windows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    titleEn: varchar('title_en', { length: 200 }).notNull(),
    titleAr: varchar('title_ar', { length: 200 }),
    descriptionEn: text('description_en'),
    descriptionAr: text('description_ar'),
    // Reuses service_status_components.key values (zoom, payment,
    // email, etc.). Empty list = unspecified.
    affectedComponents: text('affected_components')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    startAt: timestamp('start_at').notNull(),
    endAt: timestamp('end_at').notNull(),
    // Lead-time for the pre-notification. 0 = skip entirely.
    preNotificationLeadMinutes: integer(
      'pre_notification_lead_minutes',
    )
      .notNull()
      .default(60),
    preNotificationSentAt: timestamp('pre_notification_sent_at'),
    // scheduled → active → completed | cancelled
    status: varchar('status', { length: 20 }).notNull().default('scheduled'),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('scheduled_maintenance_status_idx').on(table.status),
    index('scheduled_maintenance_start_idx').on(table.startAt),
    index('scheduled_maintenance_end_idx').on(table.endAt),
    check(
      'scheduled_maintenance_status_check',
      sql`${table.status} IN ('scheduled', 'active', 'completed', 'cancelled')`,
    ),
    check(
      'scheduled_maintenance_end_after_start',
      sql`${table.endAt} > ${table.startAt}`,
    ),
  ],
);

export type ScheduledMaintenanceWindow =
  typeof scheduledMaintenanceWindows.$inferSelect;
export type NewScheduledMaintenanceWindow =
  typeof scheduledMaintenanceWindows.$inferInsert;

export const SCHEDULED_MAINTENANCE_STATUS = {
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type ScheduledMaintenanceStatus =
  (typeof SCHEDULED_MAINTENANCE_STATUS)[keyof typeof SCHEDULED_MAINTENANCE_STATUS];
