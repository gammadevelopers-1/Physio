// ===========================================
// Database Schema - Drizzle ORM
// ===========================================

// Auth schemas
export * from './users';
export * from './refresh-tokens';
export * from './roles';
export * from './two-factor';
export * from './email-verifications';
export * from './role-requests';
export * from './blocked-national-ids';
export * from './admin-notifications';
export * from './user-notifications';

// Course schemas
export * from './courses';
export * from './course-modules';
export * from './module-completions';

// Session schemas
export * from './sessions';
export * from './webinar-registrations';

// Enrollment & Attendance schemas
export * from './enrollments';
export * from './attendance';

// Payment schemas
export * from './payments';

// Assessment schemas
export * from './assessments';
export * from './questions';
export * from './submissions';
export * from './assessment-overrides';
export * from './assessment-retake-grants';

// Course Material schemas
export * from './course-materials';
export * from './material-variants';
export * from './material-progress';

// Certificate schemas
export * from './certificate-requests';

// User Preferences schemas
export * from './user-preferences';

// Intervention schemas
export * from './interventions';

// NELC Compliance schemas
export * from './nelc-audit-logs';
export * from './session-assistants';
export * from './course-assistants';
export * from './attendance-logs';

// Session Recordings schemas
export * from './session-recordings';

// Support Tickets schemas
export * from './tickets';

// Audit Logs schemas
export * from './audit-logs';

// Scheduled Reports schemas
export * from './scheduled-reports';

// Course Ratings schemas
export * from './course-ratings';
export * from './instructor-ratings';

// Waitlist schemas
export * from './waitlists';

// Video Watch Events schemas
export * from './video-watch-events';

// Session Materials schemas
export * from './session-materials';

// Points System schemas
export * from './point-rules';
export * from './point-transactions';
export * from './point-redemptions';
export * from './points-config';
export * from './course-redemption-settings';

// Health check (can remove later)
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const healthCheck = pgTable('health_check', {
  id: uuid('id').primaryKey().defaultRandom(),
  checkedAt: timestamp('checked_at').defaultNow().notNull(),
  status: varchar('status', { length: 50 }).notNull().default('ok'),
});
