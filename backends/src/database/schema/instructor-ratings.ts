import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  varchar,
  boolean,
  index,
  unique,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { courses } from './courses';
import { users } from './users';

export const instructorRatings = pgTable(
  'instructor_ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    instructorId: uuid('instructor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    reviewText: text('review_text'),
    moderationStatus: varchar('moderation_status', { length: 20 }).notNull().default('pending'),
    isPublished: boolean('is_published').notNull().default(false),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('instructor_ratings_course_id_idx').on(table.courseId),
    index('instructor_ratings_instructor_id_idx').on(table.instructorId),
    index('instructor_ratings_student_id_idx').on(table.studentId),
    index('instructor_ratings_moderation_idx').on(table.moderationStatus),
    index('instructor_ratings_published_idx').on(table.isPublished),
    unique('instructor_ratings_course_student_unique').on(table.courseId, table.studentId),
    check('instructor_ratings_rating_check', sql`${table.rating} >= 1 AND ${table.rating} <= 5`),
    check(
      'instructor_ratings_moderation_status_check',
      sql`${table.moderationStatus} IN ('pending', 'approved', 'rejected')`,
    ),
  ],
);

export const instructorRatingsRelations = relations(instructorRatings, ({ one }) => ({
  course: one(courses, {
    fields: [instructorRatings.courseId],
    references: [courses.id],
  }),
  instructor: one(users, {
    fields: [instructorRatings.instructorId],
    references: [users.id],
    relationName: 'instructorRatingTarget',
  }),
  student: one(users, {
    fields: [instructorRatings.studentId],
    references: [users.id],
    relationName: 'instructorRatingAuthor',
  }),
}));

export type InstructorRating = typeof instructorRatings.$inferSelect;
export type NewInstructorRating = typeof instructorRatings.$inferInsert;
