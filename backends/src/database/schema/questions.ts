import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { assessments } from './assessments';
import { courses } from './courses';

export interface QuestionOption {
  text: string;
  textAr?: string;
  isCorrect: boolean;
}

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id').references(() => assessments.id, {
      onDelete: 'cascade',
    }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 20 }).notNull(),
    questionText: text('question_text').notNull(),
    questionTextAr: text('question_text_ar'),
    options: jsonb('options').$type<QuestionOption[]>(),
    correctAnswer: text('correct_answer'),
    marks: integer('marks').notNull().default(1),
    difficultyLevel: varchar('difficulty_level', { length: 20 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('questions_assessment_id_idx').on(table.assessmentId),
    index('questions_course_id_idx').on(table.courseId),
    index('questions_type_idx').on(table.type),
    index('questions_difficulty_level_idx').on(table.difficultyLevel),
    check(
      'questions_type_check',
      sql`${table.type} IN ('mcq', 'true_false', 'short_answer', 'essay')`,
    ),
    check(
      'questions_difficulty_check',
      sql`${table.difficultyLevel} IS NULL OR ${table.difficultyLevel} IN ('easy', 'medium', 'hard')`,
    ),
  ],
);

export const questionsRelations = relations(questions, ({ one }) => ({
  assessment: one(assessments, {
    fields: [questions.assessmentId],
    references: [assessments.id],
  }),
  course: one(courses, {
    fields: [questions.courseId],
    references: [courses.id],
  }),
}));

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;

export const QUESTION_TYPE = {
  MCQ: 'mcq',
  TRUE_FALSE: 'true_false',
  SHORT_ANSWER: 'short_answer',
  ESSAY: 'essay',
} as const;

export type QuestionType =
  (typeof QUESTION_TYPE)[keyof typeof QUESTION_TYPE];

export const DIFFICULTY_LEVEL = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
} as const;

export type DifficultyLevel =
  (typeof DIFFICULTY_LEVEL)[keyof typeof DIFFICULTY_LEVEL];
