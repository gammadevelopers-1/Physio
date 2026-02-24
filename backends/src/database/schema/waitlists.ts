import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { courses } from './courses';
import { users } from './users';

export const waitlists = pgTable(
  'waitlists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('waiting'),
    position: integer('position').notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
    notifiedAt: timestamp('notified_at'),
    expiresAt: timestamp('expires_at'),
  },
  (table) => [
    uniqueIndex('waitlists_course_student_unique').on(
      table.courseId,
      table.studentId,
    ),
    index('waitlists_course_id_idx').on(table.courseId),
    index('waitlists_student_id_idx').on(table.studentId),
    index('waitlists_status_idx').on(table.status),
    check(
      'waitlists_status_check',
      sql`${table.status} IN ('waiting', 'notified', 'enrolled', 'expired', 'cancelled')`,
    ),
  ],
);

export const waitlistsRelations = relations(waitlists, ({ one }) => ({
  course: one(courses, {
    fields: [waitlists.courseId],
    references: [courses.id],
  }),
  student: one(users, {
    fields: [waitlists.studentId],
    references: [users.id],
  }),
}));

export type Waitlist = typeof waitlists.$inferSelect;
export type NewWaitlist = typeof waitlists.$inferInsert;

export const WAITLIST_STATUS = {
  WAITING: 'waiting',
  NOTIFIED: 'notified',
  ENROLLED: 'enrolled',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;
