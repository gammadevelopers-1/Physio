import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  uniqueIndex,
  index,
  check,
  integer,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { courses } from './courses';
import { users } from './users';

export const courseAssistants = pgTable(
  'course_assistants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: varchar('status', { length: 20 }).notNull().default('approved'),
    priority: integer('priority').notNull().default(1),
    suggestedBy: uuid('suggested_by').references(() => users.id),
    approvedBy: uuid('approved_by').references(() => users.id),
    assignedBy: uuid('assigned_by').references(() => users.id),
    assignedAt: timestamp('assigned_at').defaultNow().notNull(),
    approvedAt: timestamp('approved_at'),
    deactivationScheduledAt: timestamp('deactivation_scheduled_at'),
  },
  (table) => [
    uniqueIndex('course_assistants_course_user_unique').on(
      table.courseId,
      table.userId,
    ),
    index('course_assistants_course_id_idx').on(table.courseId),
    index('course_assistants_user_id_idx').on(table.userId),
    check(
      'course_assistants_status_check',
      sql`${table.status} IN ('suggested', 'pre_assigned', 'approved', 'rejected')`,
    ),
  ],
);

export const courseAssistantsRelations = relations(
  courseAssistants,
  ({ one }) => ({
    course: one(courses, {
      fields: [courseAssistants.courseId],
      references: [courses.id],
    }),
    user: one(users, {
      fields: [courseAssistants.userId],
      references: [users.id],
    }),
    suggester: one(users, {
      fields: [courseAssistants.suggestedBy],
      references: [users.id],
    }),
    approver: one(users, {
      fields: [courseAssistants.approvedBy],
      references: [users.id],
    }),
    assigner: one(users, {
      fields: [courseAssistants.assignedBy],
      references: [users.id],
    }),
  }),
);

export type CourseAssistant = typeof courseAssistants.$inferSelect;
export type NewCourseAssistant = typeof courseAssistants.$inferInsert;
