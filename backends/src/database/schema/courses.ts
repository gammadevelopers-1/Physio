import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  date,
  timestamp,
  index,
  check,
  boolean,
  numeric,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';

export const courses = pgTable(
  'courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instructorId: uuid('instructor_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 255 }).notNull(),
    titleAr: varchar('title_ar', { length: 255 }),
    description: text('description'),
    descriptionAr: text('description_ar'),
    deliveryType: varchar('delivery_type', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    thumbnail: varchar('thumbnail', { length: 500 }),
    maxEnrollment: integer('max_enrollment'),
    price: numeric('price', { precision: 10, scale: 2 }).default('0'),
    cmeHours: integer('cme_hours').default(0),
    enrollmentDeadline: timestamp('enrollment_deadline'),
    isCmeAccredited: boolean('is_cme_accredited').default(false),
    language: varchar('language', { length: 10 }).default('en'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('courses_instructor_id_idx').on(table.instructorId),
    index('courses_status_idx').on(table.status),
    check(
      'courses_delivery_type_check',
      sql`${table.deliveryType} IN ('zoom', 'onsite', 'blended')`,
    ),
    check(
      'courses_status_check',
      sql`${table.status} IN ('draft', 'active', 'completed', 'archived')`,
    ),
  ],
);

export const coursesRelations = relations(courses, ({ one }) => ({
  instructor: one(users, {
    fields: [courses.instructorId],
    references: [users.id],
  }),
}));

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

export const COURSE_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;

export type CourseStatus =
  (typeof COURSE_STATUS)[keyof typeof COURSE_STATUS];

export const DELIVERY_TYPE = {
  ZOOM: 'zoom',
  ONSITE: 'onsite',
  BLENDED: 'blended',
} as const;

export type DeliveryType =
  (typeof DELIVERY_TYPE)[keyof typeof DELIVERY_TYPE];
