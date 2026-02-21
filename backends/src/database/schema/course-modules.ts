import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { courses } from './courses';
import { courseMaterials } from './course-materials';

export const courseModules = pgTable(
  'course_modules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    titleAr: varchar('title_ar', { length: 255 }),
    orderIndex: integer('order_index').notNull().default(0),
    type: varchar('type', { length: 20 }).notNull(),
    durationMinutes: integer('duration_minutes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('course_modules_course_id_idx').on(table.courseId),
    index('course_modules_course_id_order_idx').on(
      table.courseId,
      table.orderIndex,
    ),
    check(
      'course_modules_type_check',
      sql`${table.type} IN ('video', 'document', 'quiz', 'mixed')`,
    ),
  ],
);

export const courseModulesRelations = relations(courseModules, ({ one, many }) => ({
  course: one(courses, {
    fields: [courseModules.courseId],
    references: [courses.id],
  }),
  materials: many(courseMaterials),
}));

export type CourseModule = typeof courseModules.$inferSelect;
export type NewCourseModule = typeof courseModules.$inferInsert;

export const MODULE_TYPE = {
  VIDEO: 'video',
  DOCUMENT: 'document',
  QUIZ: 'quiz',
  MIXED: 'mixed',
} as const;

export type ModuleType = (typeof MODULE_TYPE)[keyof typeof MODULE_TYPE];
