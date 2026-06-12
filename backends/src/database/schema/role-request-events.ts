import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { roleRequests } from './role-requests';
import { users } from './users';

/**
 * Append-only audit of every state transition on a role_request.
 * The legacy `role_requests.reviewed_by/at/note` columns are single-slot
 * and get overwritten on each action — this table preserves the full
 * timeline so support staff and admins can see "who decided what, when,
 * and why" across resubmits.
 *
 * `performed_by` is NULL for applicant actions (submitted, resubmitted)
 * since applicants aren't staff users — for placeholder users, the
 * `role_requests.user_id` already identifies the applicant.
 *
 * `missing_requirements` mirrors the value persisted to
 * `role_requests.missing_requirements` at the moment of a
 * `requested_info` event, so the history shows what was missing each
 * time it was raised.
 */
export const roleRequestEvents = pgTable(
  'role_request_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roleRequestId: uuid('role_request_id')
      .notNull()
      .references(() => roleRequests.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 30 }).notNull(),
    performedBy: uuid('performed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    note: text('note'),
    missingRequirements: jsonb('missing_requirements').$type<MissingRequirement[]>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('role_request_events_request_id_idx').on(table.roleRequestId),
    index('role_request_events_created_at_idx').on(table.createdAt),
    index('role_request_events_action_idx').on(table.action),
    check(
      'role_request_events_action_check',
      sql`${table.action} IN ('submitted', 'approved', 'rejected', 'requested_info', 'resubmitted')`,
    ),
  ],
);

export const roleRequestEventsRelations = relations(
  roleRequestEvents,
  ({ one }) => ({
    request: one(roleRequests, {
      fields: [roleRequestEvents.roleRequestId],
      references: [roleRequests.id],
    }),
    performer: one(users, {
      fields: [roleRequestEvents.performedBy],
      references: [users.id],
    }),
  }),
);

export type RoleRequestEvent = typeof roleRequestEvents.$inferSelect;
export type NewRoleRequestEvent = typeof roleRequestEvents.$inferInsert;

/**
 * Action enum — keep in sync with the SQL check constraint.
 */
export const ROLE_REQUEST_EVENT_ACTIONS = {
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REQUESTED_INFO: 'requested_info',
  RESUBMITTED: 'resubmitted',
} as const;

export type RoleRequestEventAction =
  (typeof ROLE_REQUEST_EVENT_ACTIONS)[keyof typeof ROLE_REQUEST_EVENT_ACTIONS];

/**
 * Fixed enum of structured "missing requirement" codes admin can attach
 * to a `requested_info` action. `OTHER` pairs with a free-text `label`
 * so admins can call out anything not covered by the standard codes.
 *
 * When adding a new code: update this list, add an i18n key in both
 * locales (supportDashboard.trainerApplication.missingReqs.<code>),
 * and the admin's checkbox UI picks it up automatically.
 */
export const MISSING_REQUIREMENT_CODES = [
  'CV_MISSING',
  'SCFHS_VERIFICATION',
  'QUALIFICATION_DOC',
  'PHOTO',
  'BANK_DETAILS',
  'NATIONAL_ID',
  'OTHER',
] as const;

export type MissingRequirementCode = (typeof MISSING_REQUIREMENT_CODES)[number];

export type MissingRequirement = {
  code: MissingRequirementCode;
  /** Free-form label — required when code === 'OTHER', optional elsewhere. */
  label?: string;
  /** Optional admin note targeted at this specific requirement. */
  note?: string;
};
