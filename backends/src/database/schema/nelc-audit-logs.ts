import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const nelcAuditLogs = pgTable(
  'nelc_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventType: varchar('event_type', { length: 60 }).notNull(),
    entityType: varchar('entity_type', { length: 40 }).notNull(),
    entityId: uuid('entity_id'),
    userId: uuid('user_id').references(() => users.id),
    metadata: jsonb('metadata'),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('nelc_audit_event_type_idx').on(table.eventType),
    index('nelc_audit_entity_idx').on(table.entityType, table.entityId),
    index('nelc_audit_user_id_idx').on(table.userId),
    index('nelc_audit_created_at_idx').on(table.createdAt),
  ],
);

export type NelcAuditLog = typeof nelcAuditLogs.$inferSelect;
export type NewNelcAuditLog = typeof nelcAuditLogs.$inferInsert;

export const NELC_EVENT_TYPE = {
  SESSION_STARTED: 'session_started',
  SESSION_ENDED: 'session_ended',
  SESSION_CANCELLED: 'session_cancelled',
  ATTENDANCE_MARKED_MANUAL: 'attendance_marked_manual',
  ATTENDANCE_AUTO_SYNCED: 'attendance_auto_synced',
  ATTENDANCE_ZOOM_JOIN: 'attendance_zoom_join',
  ATTENDANCE_ZOOM_LEAVE: 'attendance_zoom_leave',
  ENROLLMENT_CREATED: 'enrollment_created',
  ENROLLMENT_LIMIT_ENFORCED: 'enrollment_limit_enforced',
  ASSISTANT_ALLOCATED: 'assistant_allocated',
  ASSISTANT_DEALLOCATED: 'assistant_deallocated',
  COMPLIANCE_CHECK_PASSED: 'compliance_check_passed',
  COMPLIANCE_CHECK_FAILED: 'compliance_check_failed',
  ZOOM_MEETING_CREATED: 'zoom_meeting_created',
  ZOOM_SYNC_COMPLETED: 'zoom_sync_completed',
  ZOOM_JOIN_LINK_GENERATED: 'zoom_join_link_generated',
  CERTIFICATE_REVOKED: 'certificate_revoked',
  COURSE_ACTIVATED: 'course_activated',
  COURSE_DEACTIVATED: 'course_deactivated',
} as const;

export type NelcEventType =
  (typeof NELC_EVENT_TYPE)[keyof typeof NELC_EVENT_TYPE];
