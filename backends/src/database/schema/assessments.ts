import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { courses } from './courses';
import { courseModules } from './course-modules';
import { users } from './users';

export const assessments = pgTable(
  'assessments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id').references(() => courseModules.id),
    title: varchar('title', { length: 255 }).notNull(),
    titleAr: varchar('title_ar', { length: 255 }),
    type: varchar('type', { length: 20 }).notNull(),
    totalMarks: integer('total_marks').notNull(),
    passingMarks: integer('passing_marks').notNull(),
    durationMinutes: integer('duration_minutes'),
    attemptsAllowed: integer('attempts_allowed').notNull().default(1),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    instructions: varchar('instructions', { length: 5000 }),
    dueDate: timestamp('due_date'),
    assignmentFiles: jsonb('assignment_files').$type<AssessmentFile[]>(),
    // Proctoring
    proctoringEnabled: boolean('proctoring_enabled').notNull().default(false),
    proctoringRules: jsonb('proctoring_rules').$type<{
      webcamRequired?: boolean;
      browserLockdown?: boolean;
      tabSwitchAlert?: boolean;
    }>(),
    timeLimitEnforced: boolean('time_limit_enforced').notNull().default(true),
    // Retake rules
    maxRetakes: integer('max_retakes').notNull().default(0),
    retakeCoolingHours: integer('retake_cooling_hours').notNull().default(24),
    retakeScorePolicy: varchar('retake_score_policy', { length: 20 }).notNull().default('highest'),
    retakeScope: varchar('retake_scope', { length: 20 }).notNull().default('full'),
    // Randomization
    randomizeOrder: boolean('randomize_order').notNull().default(false),
    questionsPerAttempt: integer('questions_per_attempt'),
    // Flagging (manager review)
    flaggedAt: timestamp('flagged_at'),
    flaggedReason: text('flagged_reason'),
    flaggedBy: uuid('flagged_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('assessments_course_id_idx').on(table.courseId),
    index('assessments_module_id_idx').on(table.moduleId),
    index('assessments_status_idx').on(table.status),
    index('assessments_type_idx').on(table.type),
    check(
      'assessments_type_check',
      sql`${table.type} IN ('quiz', 'exam', 'assignment')`,
    ),
    check(
      'assessments_status_check',
      sql`${table.status} IN ('draft', 'published', 'closed')`,
    ),
    check(
      'assessments_retake_scope_check',
      sql`${table.retakeScope} IN ('full', 'failed_sections')`,
    ),
  ],
);

export const assessmentsRelations = relations(assessments, ({ one }) => ({
  course: one(courses, {
    fields: [assessments.courseId],
    references: [courses.id],
  }),
  module: one(courseModules, {
    fields: [assessments.moduleId],
    references: [courseModules.id],
  }),
}));

export interface AssessmentFile {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

export type Assessment = typeof assessments.$inferSelect;
export type NewAssessment = typeof assessments.$inferInsert;

export const ASSESSMENT_TYPE = {
  QUIZ: 'quiz',
  EXAM: 'exam',
  ASSIGNMENT: 'assignment',
} as const;

export type AssessmentType =
  (typeof ASSESSMENT_TYPE)[keyof typeof ASSESSMENT_TYPE];

export const ASSESSMENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CLOSED: 'closed',
} as const;

export type AssessmentStatus =
  (typeof ASSESSMENT_STATUS)[keyof typeof ASSESSMENT_STATUS];
