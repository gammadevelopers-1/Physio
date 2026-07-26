import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
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
    // Admin/manager audit — who added this enrollment and why. NULL for
    // self-service enrollments (student enrolled themselves). Populated
    // when a manager/admin manually enrols the student via the Students
    // tab on the course detail page.
    enrolledBy: uuid('enrolled_by').references(() => users.id),
    enrollmentReason: varchar('enrollment_reason', { length: 500 }),
    // Removal audit — who removed the student and why. Status is set to
    // 'dropped' AND these columns are populated so we can distinguish an
    // admin removal from a student self-drop. Finance reads
    // removal_reason to decide whether a refund is appropriate.
    removedBy: uuid('removed_by').references(() => users.id),
    removedAt: timestamp('removed_at'),
    removalReason: varchar('removal_reason', { length: 500 }),
    // How this enrollment came to be. Read by finance reports + student
    // My Courses (source chip). Defaults to 'purchase' so legacy code paths
    // that omit it stay accurate for the majority case.
    source: text('source').notNull().default('purchase'),
  },
  (table) => [
    uniqueIndex('enrollments_course_student_unique').on(
      table.courseId,
      table.studentId,
    ),
    index('enrollments_course_id_idx').on(table.courseId),
    index('enrollments_student_id_idx').on(table.studentId),
    index('enrollments_status_idx').on(table.status),
    index('enrollments_enrolled_by_idx').on(table.enrolledBy),
    index('enrollments_removed_by_idx').on(table.removedBy),
    index('enrollments_removed_at_idx').on(table.removedAt),
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

export const ENROLLMENT_SOURCE = {
  PURCHASE: 'purchase',
  POINTS_REDEMPTION: 'points_redemption',
  ADMIN_GRANT: 'admin_grant',
  REWARD: 'reward',
  FREE_PUBLIC: 'free_public',
} as const;

export type EnrollmentSource =
  (typeof ENROLLMENT_SOURCE)[keyof typeof ENROLLMENT_SOURCE];
