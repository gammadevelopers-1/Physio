import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { assessments, type AssessmentFile } from './assessments';
import { users } from './users';

export interface SubmissionAnswer {
  questionId: string;
  answer: string;
  isCorrect: boolean | null;
  marksAwarded: number | null;
}

export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    answers: jsonb('answers').$type<SubmissionAnswer[]>(),
    score: integer('score'),
    totalMarks: integer('total_marks'),
    percentage: numeric('percentage', { precision: 5, scale: 2 }),
    startedAt: timestamp('started_at'),
    submittedAt: timestamp('submitted_at'),
    status: varchar('status', { length: 20 }).notNull().default('in_progress'),
    submissionFiles: jsonb('submission_files').$type<AssessmentFile[]>(),
    instructorComment: text('instructor_comment'),
    questionComments: jsonb('question_comments').$type<Record<string, string>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('submissions_assessment_id_idx').on(table.assessmentId),
    index('submissions_student_id_idx').on(table.studentId),
    index('submissions_status_idx').on(table.status),
    check(
      'submissions_status_check',
      sql`${table.status} IN ('in_progress', 'submitted', 'graded')`,
    ),
  ],
);

export const submissionsRelations = relations(submissions, ({ one }) => ({
  assessment: one(assessments, {
    fields: [submissions.assessmentId],
    references: [assessments.id],
  }),
  student: one(users, {
    fields: [submissions.studentId],
    references: [users.id],
  }),
}));

export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;

export const SUBMISSION_STATUS = {
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  GRADED: 'graded',
} as const;

export type SubmissionStatus =
  (typeof SUBMISSION_STATUS)[keyof typeof SUBMISSION_STATUS];
