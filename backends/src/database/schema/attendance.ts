import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { sessions } from './sessions';
import { users } from './users';

export const attendance = pgTable(
  'attendance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('absent'),
    joinedAt: timestamp('joined_at'),
    leftAt: timestamp('left_at'),
    durationMinutes: integer('duration_minutes'),
    markedBy: uuid('marked_by').references(() => users.id),
    note: text('note'),
  },
  (table) => [
    uniqueIndex('attendance_session_student_unique').on(
      table.sessionId,
      table.studentId,
    ),
    index('attendance_session_id_idx').on(table.sessionId),
    index('attendance_student_id_idx').on(table.studentId),
    check(
      'attendance_status_check',
      sql`${table.status} IN ('present', 'absent', 'late', 'excused')`,
    ),
  ],
);

export const attendanceRelations = relations(attendance, ({ one }) => ({
  session: one(sessions, {
    fields: [attendance.sessionId],
    references: [sessions.id],
  }),
  student: one(users, {
    fields: [attendance.studentId],
    references: [users.id],
  }),
  marker: one(users, {
    fields: [attendance.markedBy],
    references: [users.id],
  }),
}));

export type Attendance = typeof attendance.$inferSelect;
export type NewAttendance = typeof attendance.$inferInsert;

export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  EXCUSED: 'excused',
} as const;

export type AttendanceStatus =
  (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];
