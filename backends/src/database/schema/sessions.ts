import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  index,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { courses } from './courses';
import { users } from './users';

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    instructorId: uuid('instructor_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 255 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    scheduledAt: timestamp('scheduled_at').notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(60),
    zoomLink: varchar('zoom_link', { length: 500 }),
    meetingId: varchar('meeting_id', { length: 100 }),
    roomName: varchar('room_name', { length: 255 }),
    venueAddress: text('venue_address'),
    city: varchar('city', { length: 100 }),
    status: varchar('status', { length: 20 }).notNull().default('scheduled'),
    actualStartedAt: timestamp('actual_started_at'),
    actualEndedAt: timestamp('actual_ended_at'),
    cancelReason: text('cancel_reason'),
    rescheduleReason: text('reschedule_reason'),
    rescheduledToId: uuid('rescheduled_to_id'),
    reminderSentAt: timestamp('reminder_sent_at'),
    autoEndWarningSentAt: timestamp('auto_end_warning_sent_at'),
    recordingEnabled: boolean('recording_enabled').notNull().default(true),
    zoomSyncedAt: timestamp('zoom_synced_at'),
    // Webinar support — when true, this session was created as a Zoom
    // Webinar (with a public registration page) instead of a Meeting.
    // The two are mutually exclusive: a session is either a meeting
    // (meetingId set) OR a webinar (zoomWebinarId set), never both.
    isWebinar: boolean('is_webinar').notNull().default(false),
    zoomWebinarId: varchar('zoom_webinar_id', { length: 50 }),
    webinarRegistrationUrl: varchar('webinar_registration_url', { length: 500 }),
    isMakeup: boolean('is_makeup').notNull().default(false),
    parentSessionId: uuid('parent_session_id').references((): AnyPgColumn => sessions.id, { onDelete: 'set null' }),
    assignedStudents: jsonb('assigned_students').$type<string[]>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('sessions_course_id_idx').on(table.courseId),
    index('sessions_instructor_id_idx').on(table.instructorId),
    index('sessions_scheduled_at_idx').on(table.scheduledAt),
    index('sessions_status_idx').on(table.status),
    index('sessions_parent_session_id_idx').on(table.parentSessionId),
    check(
      'sessions_type_check',
      sql`${table.type} IN ('zoom', 'onsite', 'hybrid')`,
    ),
    check(
      'sessions_status_check',
      sql`${table.status} IN ('scheduled', 'live', 'ended', 'completed', 'cancelled', 'missed', 'rescheduled')`,
    ),
  ],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  course: one(courses, {
    fields: [sessions.courseId],
    references: [courses.id],
  }),
  instructor: one(users, {
    fields: [sessions.instructorId],
    references: [users.id],
  }),
}));

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export const SESSION_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  ENDED: 'ended',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  MISSED: 'missed',
  RESCHEDULED: 'rescheduled',
} as const;

export type SessionStatus =
  (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

export const SESSION_TYPE = {
  ZOOM: 'zoom',
  ONSITE: 'onsite',
  HYBRID: 'hybrid',
} as const;

export type SessionType =
  (typeof SESSION_TYPE)[keyof typeof SESSION_TYPE];
