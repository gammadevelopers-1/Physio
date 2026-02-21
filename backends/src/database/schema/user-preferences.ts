import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
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

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
