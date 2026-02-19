import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { courses } from './courses';

export const interventions = pgTable(
  'interventions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instructorId: uuid('instructor_id')
      .notNull()
      .references(() => users.id),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').references(() => courses.id, {
      onDelete: 'set null',
    }),
    type: varchar('type', { length: 30 }).notNull(), // email | makeup_session | ticket
    message: text('message'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('interventions_instructor_id_idx').on(table.instructorId),
    index('interventions_student_id_idx').on(table.studentId),
    index('interventions_course_id_idx').on(table.courseId),
    index('interventions_type_idx').on(table.type),
  ],
);

export const interventionsRelations = relations(interventions, ({ one }) => ({
  instructor: one(users, {
    fields: [interventions.instructorId],
    references: [users.id],
    relationName: 'interventionInstructor',
  }),
  student: one(users, {
    fields: [interventions.studentId],
    references: [users.id],
    relationName: 'interventionStudent',
  }),
  course: one(courses, {
    fields: [interventions.courseId],
    references: [courses.id],
  }),
}));

export const INTERVENTION_TYPE = {
  EMAIL: 'email',
  MAKEUP_SESSION: 'makeup_session',
  TICKET: 'ticket',
} as const;

export type InterventionType =
  (typeof INTERVENTION_TYPE)[keyof typeof INTERVENTION_TYPE];
