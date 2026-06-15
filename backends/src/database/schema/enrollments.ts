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

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    progress: integer('progress').notNull().default(0),
    enrolledAt: timestamp('enrolled_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
    lastAccessedAt: timestamp('last_accessed_at'),
  },
  (table) => [
    uniqueIndex('enrollments_course_student_unique').on(
      table.courseId,
      table.studentId,
    ),
    index('enrollments_course_id_idx').on(table.courseId),
    index('enrollments_student_id_idx').on(table.studentId),
    index('enrollments_status_idx').on(table.status),
    check(
      'enrollments_status_check',
      sql`${table.status} IN ('pending_payment', 'active', 'completed', 'dropped', 'suspended')`,
    ),
    check(
      'enrollments_progress_check',
      sql`${table.progress} >= 0 AND ${table.progress} <= 100`,
    ),
  ],
);

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id],
  }),
  student: one(users, {
    fields: [enrollments.studentId],
    references: [users.id],
  }),
}));

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;

export const ENROLLMENT_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
  SUSPENDED: 'suspended',
} as const;

export type EnrollmentStatus =
  (typeof ENROLLMENT_STATUS)[keyof typeof ENROLLMENT_STATUS];
