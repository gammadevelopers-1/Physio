import {
  pgTable,
  uuid,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { courses } from './courses';
import { courseModules } from './course-modules';

/**
 * Per-student per-module completion record.
 *
 * Source of truth for "did this student finish this module". One row per
 * (studentId, moduleId) pair; UNIQUE prevents double-counting on repeated
 * "Mark Complete" clicks. Used by the unified-progress recompute helper:
 *   progress = (completed modules + attended sessions + done assessments)
 *            / (total modules + non-cancelled sessions + published assessments)
 *
 * The previous implementation derived module completion by reverse-
 * engineering it from `enrollments.progress` percentage — fragile and
 * delivery-type-dependent. This table replaces that.
 */
export const moduleCompletions = pgTable(
  'module_completions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => courseModules.id, { onDelete: 'cascade' }),
    completedAt: timestamp('completed_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('module_completions_student_module_unique').on(
      table.studentId,
      table.moduleId,
    ),
    index('module_completions_student_course_idx').on(
      table.studentId,
      table.courseId,
    ),
    index('module_completions_course_id_idx').on(table.courseId),
  ],
);

export const moduleCompletionsRelations = relations(
  moduleCompletions,
  ({ one }) => ({
    student: one(users, {
      fields: [moduleCompletions.studentId],
      references: [users.id],
    }),
    course: one(courses, {
      fields: [moduleCompletions.courseId],
      references: [courses.id],
    }),
    module: one(courseModules, {
      fields: [moduleCompletions.moduleId],
      references: [courseModules.id],
    }),
  }),
);

export type ModuleCompletion = typeof moduleCompletions.$inferSelect;
export type NewModuleCompletion = typeof moduleCompletions.$inferInsert;
