import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// ===========================================
// Role Requests Table - Application workflow
// ===========================================
export const roleRequests = pgTable('role_requests', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Applicant
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Requested role (e.g. 'INSTRUCTOR')
  requestedRole: varchar('requested_role', { length: 50 }).notNull(),

  // Status: PENDING | APPROVED | REJECTED | MORE_INFO
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),

  // Application data (JSONB)
  profileData: jsonb('profile_data').notNull(),
  bankData: jsonb('bank_data'),
  resumeFiles: jsonb('resume_files'),
  // Structured resume entries for the "Create Resume" path. Shape:
  // { education: [...], professionalSkills: [...],
  //   scientificResearches: [...], trainingExperiences: [...] }
  // Nullable — applicants who upload a resume file leave this empty.
  structuredResume: jsonb('structured_resume'),

  // Review (single-slot, legacy — preserved for back-compat with the
  // existing admin UI. The full history of who-decided-what across
  // resubmits lives in `role_request_events`.)
  reviewedBy: uuid('reviewed_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  reviewNote: text('review_note'),
  reviewedAt: timestamp('reviewed_at'),

  // Structured "what's missing" checklist. Populated when status =
  // MORE_INFO; cleared (or replaced) on every admin action. Shape:
  // Array<{ code: MissingRequirementCode, label?: string, note?: string }>
  missingRequirements: jsonb('missing_requirements'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ===========================================
// Relations
// ===========================================
export const roleRequestsRelations = relations(roleRequests, ({ one }) => ({
  user: one(users, {
    fields: [roleRequests.userId],
    references: [users.id],
    relationName: 'roleRequestUser',
  }),
  reviewer: one(users, {
    fields: [roleRequests.reviewedBy],
    references: [users.id],
    relationName: 'roleRequestReviewer',
  }),
}));

// ===========================================
// Type Exports
// ===========================================
export type RoleRequest = typeof roleRequests.$inferSelect;
export type NewRoleRequest = typeof roleRequests.$inferInsert;

// Status enum for type safety
export const ROLE_REQUEST_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  MORE_INFO: 'MORE_INFO',
} as const;

export type RoleRequestStatus =
  (typeof ROLE_REQUEST_STATUS)[keyof typeof ROLE_REQUEST_STATUS];
