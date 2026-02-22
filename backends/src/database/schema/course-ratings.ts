import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  index,
  unique,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { courses } from './courses';
import { users } from './users';

export const courseRatings = pgTable(
  'course_ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    reviewText: text('review_text'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('course_ratings_course_id_idx').on(table.courseId),
    index('course_ratings_student_id_idx').on(table.studentId),
    unique('course_ratings_course_student_unique').on(table.courseId, table.studentId),
    check('course_ratings_rating_check', sql`${table.rating} >= 1 AND ${table.rating} <= 5`),
  ],
);

export const courseRatingsRelations = relations(courseRatings, ({ one }) => ({
  course: one(courses, {
    fields: [courseRatings.courseId],
    references: [courses.id],
  }),
  student: one(users, {
    fields: [courseRatings.studentId],
    references: [users.id],
  }),
}));

export type CourseRating = typeof courseRatings.$inferSelect;
export type NewCourseRating = typeof courseRatings.$inferInsert;
