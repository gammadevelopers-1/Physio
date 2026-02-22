import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),

  // Notification preferences
  emailNewStudent: boolean('email_new_student').default(true),
  emailCourseComplete: boolean('email_course_complete').default(true),
  emailAssessmentSubmit: boolean('email_assessment_submit').default(false),
  emailCertificateRequest: boolean('email_certificate_request').default(true),
  pushNewSession: boolean('push_new_session').default(true),
  pushStudentMessage: boolean('push_student_message').default(true),
  pushSystemUpdates: boolean('push_system_updates').default(false),
  digestWeekly: boolean('digest_weekly').default(true),
  digestMonthly: boolean('digest_monthly').default(false),

  // UI preferences
  theme: varchar('theme', { length: 20 }).default('light'),
  dateFormat: varchar('date_format', { length: 20 }).default('MM/DD/YYYY'),
  timeFormat: varchar('time_format', { length: 10 }).default('12h'),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  defaultView: varchar('default_view', { length: 30 }).default('dashboard'),
  compactMode: boolean('compact_mode').default(false),
  showTips: boolean('show_tips').default(true),

  // Accessibility preferences
  highContrast: boolean('high_contrast').default(false),
  fontSize: varchar('font_size', { length: 10 }).default('medium'),
  reduceMotion: boolean('reduce_motion').default(false),

  // Default policy preferences (Course Manager)
  policyEnrollmentLimit: integer('policy_enrollment_limit').default(30),
  policyRequireContentReview: boolean('policy_require_content_review').default(true),
  policyAutoApproveCertificates: boolean('policy_auto_approve_certificates').default(false),
  policyCancellationNoticeHours: integer('policy_cancellation_notice_hours').default(24),
  policyMaxInstructorWeeklyHours: integer('policy_max_instructor_weekly_hours').default(15),
  policyEnforceNelcCompliance: boolean('policy_enforce_nelc_compliance').default(true),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
