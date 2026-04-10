import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { assessments } from './assessments';
import { users } from './users';

/**
 * Per-student retake grants. Each row represents one extra attempt the
 * manager has explicitly authorized for a specific student on a specific
 * assessment. There is no cap — managers can grant any number of retakes.
 *
 * - `usedAt` is set when the student starts/submits the retake attempt.
 * - `newDueDate` is only meaningful for assignments — it overrides the
 *   global assessment.dueDate for this student's retake window.
 * - Retakes are always full assessments (no partial-section retakes).
 */
export const assessmentRetakeGrants = pgTable(
  'assessment_retake_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    grantedBy: uuid('granted_by')
      .notNull()
      .references(() => users.id),
    reason: text('reason'),
    // Assignment-only: per-student deadline override for this retake
    newDueDate: timestamp('new_due_date'),
    // When the student starts the retake attempt (consumed)
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('assessment_retake_grants_assessment_idx').on(table.assessmentId),
    index('assessment_retake_grants_student_idx').on(table.studentId),
    index('assessment_retake_grants_unused_idx').on(
      table.assessmentId,
      table.studentId,
      table.usedAt,
    ),
  ],
);

export const assessmentRetakeGrantsRelations = relations(
  assessmentRetakeGrants,
  ({ one }) => ({
    assessment: one(assessments, {
      fields: [assessmentRetakeGrants.assessmentId],
      references: [assessments.id],
    }),
    student: one(users, {
      fields: [assessmentRetakeGrants.studentId],
      references: [users.id],
      relationName: 'retakeGrantStudent',
    }),
    granter: one(users, {
      fields: [assessmentRetakeGrants.grantedBy],
      references: [users.id],
      relationName: 'retakeGrantGranter',
    }),
  }),
);

export type AssessmentRetakeGrant = typeof assessmentRetakeGrants.$inferSelect;
export type NewAssessmentRetakeGrant = typeof assessmentRetakeGrants.$inferInsert;
