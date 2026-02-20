import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { sessions } from './sessions';
import { users } from './users';

export const attendanceLogs = pgTable(
  'attendance_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    eventType: varchar('event_type', { length: 20 }).notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    zoomParticipantId: varchar('zoom_participant_id', { length: 100 }),
    zoomUserEmail: varchar('zoom_user_email', { length: 255 }),
    rawPayload: jsonb('raw_payload'),
  },
  (table) => [
    index('attendance_logs_session_id_idx').on(table.sessionId),
    index('attendance_logs_student_id_idx').on(table.studentId),
    index('attendance_logs_session_student_idx').on(
      table.sessionId,
      table.studentId,
    ),
  ],
);

export const attendanceLogsRelations = relations(
  attendanceLogs,
  ({ one }) => ({
    session: one(sessions, {
      fields: [attendanceLogs.sessionId],
      references: [sessions.id],
    }),
    student: one(users, {
      fields: [attendanceLogs.studentId],
      references: [users.id],
    }),
  }),
);

export type AttendanceLog = typeof attendanceLogs.$inferSelect;
export type NewAttendanceLog = typeof attendanceLogs.$inferInsert;

export const ATTENDANCE_LOG_EVENT = {
  JOIN: 'join',
  LEAVE: 'leave',
} as const;
