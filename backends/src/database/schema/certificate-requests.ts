import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  text,
  timestamp,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { courses } from './courses';
import { users } from './users';

export const certificateRequests = pgTable(
  'certificate_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    attendancePercent: numeric('attendance_percent', {
      precision: 5,
      scale: 2,
    }),
    assessmentPassed: boolean('assessment_passed'),
    courseCompleted: boolean('course_completed'),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewNote: text('review_note'),
    reviewedAt: timestamp('reviewed_at'),
    certificateUrl: varchar('certificate_url', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('certificate_requests_course_student_unique').on(
      table.courseId,
      table.studentId,
    ),
    index('certificate_requests_course_id_idx').on(table.courseId),
    index('certificate_requests_student_id_idx').on(table.studentId),
    index('certificate_requests_status_idx').on(table.status),
    check(
      'certificate_requests_status_check',
      sql`${table.status} IN ('pending', 'approved', 'rejected', 'held', 'revoked')`,
    ),
  ],
);

export const certificateRequestsRelations = relations(
  certificateRequests,
  ({ one }) => ({
    course: one(courses, {
      fields: [certificateRequests.courseId],
      references: [courses.id],
    }),
    student: one(users, {
      fields: [certificateRequests.studentId],
      references: [users.id],
    }),
    reviewer: one(users, {
      fields: [certificateRequests.reviewedBy],
      references: [users.id],
    }),
  }),
);

export type CertificateRequest = typeof certificateRequests.$inferSelect;
export type NewCertificateRequest = typeof certificateRequests.$inferInsert;

export const CERTIFICATE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  HELD: 'held',
  REVOKED: 'revoked',
} as const;

export type CertificateStatus =
  (typeof CERTIFICATE_STATUS)[keyof typeof CERTIFICATE_STATUS];
