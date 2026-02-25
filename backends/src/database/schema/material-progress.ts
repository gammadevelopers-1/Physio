import {
  pgTable,
  uuid,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { courseMaterials } from './course-materials';
import { courses } from './courses';
import { courseModules } from './course-modules';

export const materialProgress = pgTable(
  'material_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    materialId: uuid('material_id')
      .notNull()
      .references(() => courseMaterials.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id').references(() => courseModules.id, {
      onDelete: 'set null',
    }),
    watchedSeconds: integer('watched_seconds').notNull().default(0),
    totalSeconds: integer('total_seconds').notNull().default(0),
    furthestWatchedSecond: integer('furthest_watched_second')
      .notNull()
      .default(0),
    completedAt: timestamp('completed_at'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('material_progress_student_material_unique').on(
      table.studentId,
      table.materialId,
    ),
    index('material_progress_student_id_idx').on(table.studentId),
    index('material_progress_course_id_idx').on(table.courseId),
  ],
);

export const materialProgressRelations = relations(
  materialProgress,
  ({ one }) => ({
    student: one(users, {
      fields: [materialProgress.studentId],
      references: [users.id],
    }),
    material: one(courseMaterials, {
      fields: [materialProgress.materialId],
      references: [courseMaterials.id],
    }),
    course: one(courses, {
      fields: [materialProgress.courseId],
      references: [courses.id],
    }),
    module: one(courseModules, {
      fields: [materialProgress.moduleId],
      references: [courseModules.id],
    }),
  }),
);

export type MaterialProgress = typeof materialProgress.$inferSelect;
export type NewMaterialProgress = typeof materialProgress.$inferInsert;
