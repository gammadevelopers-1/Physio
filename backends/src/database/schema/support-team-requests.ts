import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// ===========================================
// Support Team Requests
// Supervisor → Admin requests to add an agent to their team.
//
// Two kinds:
//   - add_existing: link an already-existing SUPPORT user (candidateUserId)
//   - add_new:      create a brand-new user account (candidateEmail + name)
//
// Status lifecycle: pending → approved | rejected.
// Admin actions are audited via the audit_logs table.
// ===========================================
export const SUPPORT_TEAM_REQUEST_KIND = {
  ADD_EXISTING: 'add_existing',
  ADD_NEW: 'add_new',
} as const;
export type SupportTeamRequestKind =
  (typeof SUPPORT_TEAM_REQUEST_KIND)[keyof typeof SUPPORT_TEAM_REQUEST_KIND];

export const SUPPORT_TEAM_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;
export type SupportTeamRequestStatus =
  (typeof SUPPORT_TEAM_REQUEST_STATUS)[keyof typeof SUPPORT_TEAM_REQUEST_STATUS];

export const supportTeamRequests = pgTable(
  'support_team_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Requesting supervisor
    supervisorId: uuid('supervisor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // 'add_existing' | 'add_new'
    kind: varchar('kind', { length: 20 }).notNull(),

    // For add_existing — the user to add.
    candidateUserId: uuid('candidate_user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),

    // For add_new — the prospective user's contact details.
    candidateEmail: varchar('candidate_email', { length: 320 }),
    candidateFirstName: varchar('candidate_first_name', { length: 100 }),
    candidateLastName: varchar('candidate_last_name', { length: 100 }),
    candidatePhone: varchar('candidate_phone', { length: 40 }),

    // Supervisor's justification — surfaced to the admin reviewing the request.
    reason: text('reason'),

    // 'pending' | 'approved' | 'rejected'
    status: varchar('status', { length: 20 }).notNull().default('pending'),

    // Admin review
    reviewedBy: uuid('reviewed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at'),
    decisionReason: text('decision_reason'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('support_team_requests_status_idx').on(table.status),
    index('support_team_requests_supervisor_idx').on(table.supervisorId),
    index('support_team_requests_created_at_idx').on(table.createdAt),
  ],
);

export const supportTeamRequestsRelations = relations(
  supportTeamRequests,
  ({ one }) => ({
    supervisor: one(users, {
      fields: [supportTeamRequests.supervisorId],
      references: [users.id],
      relationName: 'teamRequestSupervisor',
    }),
    candidate: one(users, {
      fields: [supportTeamRequests.candidateUserId],
      references: [users.id],
      relationName: 'teamRequestCandidate',
    }),
    reviewer: one(users, {
      fields: [supportTeamRequests.reviewedBy],
      references: [users.id],
      relationName: 'teamRequestReviewer',
    }),
  }),
);

export type SupportTeamRequest = typeof supportTeamRequests.$inferSelect;
export type NewSupportTeamRequest = typeof supportTeamRequests.$inferInsert;
