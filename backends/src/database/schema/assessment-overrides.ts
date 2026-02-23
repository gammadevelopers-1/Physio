import { pgTable, uuid, varchar, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { assessments } from './assessments';
import { users } from './users';

export const assessmentOverrides = pgTable(
  'assessment_overrides',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id').notNull().references(() => assessments.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    overrideType: varchar('override_type', { length: 20 }).notNull(), // 'time_extension' | 'extra_attempts'
    value: integer('value').notNull(), // minutes or count
    reason: text('reason').notNull(),
    grantedBy: uuid('granted_by').notNull().references(() => users.id),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('assessment_overrides_assessment_idx').on(table.assessmentId),
    index('assessment_overrides_student_idx').on(table.studentId),
  ],
);

export const assessmentOverridesRelations = relations(assessmentOverrides, ({ one }) => ({
  assessment: one(assessments, {
    fields: [assessmentOverrides.assessmentId],
    references: [assessments.id],
  }),
  student: one(users, {
    fields: [assessmentOverrides.studentId],
    references: [users.id],
    relationName: 'overrideStudent',
  }),
  granter: one(users, {
    fields: [assessmentOverrides.grantedBy],
    references: [users.id],
    relationName: 'overrideGranter',
  }),
}));

export type AssessmentOverride = typeof assessmentOverrides.$inferSelect;
export type NewAssessmentOverride = typeof assessmentOverrides.$inferInsert;
