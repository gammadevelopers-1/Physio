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
  jsonb,
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
    managerId: uuid('manager_id').references(() => users.id),
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
    // At-risk thresholds
    atRiskAttendanceThreshold: integer('at_risk_attendance_threshold').default(70),
    atRiskScoreThreshold: integer('at_risk_score_threshold').default(60),
    atRiskInactivityDays: integer('at_risk_inactivity_days').default(7),
    // Cohort
    cohort: varchar('cohort', { length: 100 }),
    // Course content fields (managed by course manager)
    overview: text('overview'),
    overviewAr: text('overview_ar'),
    objectives: jsonb('objectives').$type<string[]>(),
    objectivesAr: jsonb('objectives_ar').$type<string[]>(),
    features: jsonb('features').$type<string[]>(),
    featuresAr: jsonb('features_ar').$type<string[]>(),
    targetAudience: jsonb('target_audience').$type<string[]>(),
    targetAudienceAr: jsonb('target_audience_ar').$type<string[]>(),
    requirements: text('requirements'),
    requirementsAr: text('requirements_ar'),
    notices: text('notices'),
    noticesAr: text('notices_ar'),
    venue: varchar('venue', { length: 255 }),
    venueAr: varchar('venue_ar', { length: 255 }),
    showContents: boolean('show_contents').default(true),
    sectionsOrder: jsonb('sections_order').$type<string[]>(),
    // Course-level assessment defaults (per-assessment can override)
    assessmentProctoringEnabled: boolean('assessment_proctoring_enabled').default(false),
    assessmentTimeLimitEnforced: boolean('assessment_time_limit_enforced').default(true),
    assessmentMaxRetakes: integer('assessment_max_retakes').default(0),
    assessmentRetakeCoolingHours: integer('assessment_retake_cooling_hours').default(24),
    assessmentRetakeScorePolicy: varchar('assessment_retake_score_policy', { length: 20 }).default('highest'),
    assessmentRetakeScope: varchar('assessment_retake_scope', { length: 20 }).default('full'),
    // Review workflow
    reviewNote: varchar('review_note', { length: 1000 }),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    submittedAt: timestamp('submitted_at'),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('courses_instructor_id_idx').on(table.instructorId),
    index('courses_manager_id_idx').on(table.managerId),
    index('courses_status_idx').on(table.status),
    check(
      'courses_delivery_type_check',
      sql`${table.deliveryType} IN ('zoom', 'onsite', 'blended', 'self-paced')`,
    ),
    check(
      'courses_status_check',
      sql`${table.status} IN ('draft', 'pending_review', 'changes_requested', 'active', 'completed', 'archived')`,
    ),
  ],
);

export const coursesRelations = relations(courses, ({ one }) => ({
  instructor: one(users, {
    fields: [courses.instructorId],
    references: [users.id],
    relationName: 'courseInstructor',
  }),
  manager: one(users, {
    fields: [courses.managerId],
    references: [users.id],
    relationName: 'courseManager',
  }),
}));

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

export const COURSE_STATUS = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  CHANGES_REQUESTED: 'changes_requested',
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
  SELF_PACED: 'self-paced',
} as const;

export type DeliveryType =
  (typeof DELIVERY_TYPE)[keyof typeof DELIVERY_TYPE];
