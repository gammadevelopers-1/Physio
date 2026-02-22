// ===========================================
// Database Schema - Drizzle ORM
// ===========================================

// Auth schemas
export * from './users';
export * from './refresh-tokens';
export * from './roles';
export * from './two-factor';
export * from './role-requests';
export * from './blocked-national-ids';
export * from './admin-notifications';

// Course schemas
export * from './courses';
export * from './course-modules';

// Session schemas
export * from './sessions';

// Enrollment & Attendance schemas
export * from './enrollments';
export * from './attendance';

// Assessment schemas
export * from './assessments';
export * from './questions';
export * from './submissions';

// Course Material schemas
export * from './course-materials';
export * from './material-variants';

// Certificate schemas
export * from './certificate-requests';

// User Preferences schemas
export * from './user-preferences';

// Intervention schemas
export * from './interventions';

// NELC Compliance schemas
export * from './nelc-audit-logs';
export * from './session-assistants';
export * from './attendance-logs';

// Scheduled Reports schemas
export * from './scheduled-reports';

// Course Ratings schemas
export * from './course-ratings';

// Health check (can remove later)
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const healthCheck = pgTable('health_check', {
  id: uuid('id').primaryKey().defaultRandom(),
  checkedAt: timestamp('checked_at').defaultNow().notNull(),
  status: varchar('status', { length: 50 }).notNull().default('ok'),
});
