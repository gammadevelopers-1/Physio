import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sessions } from './sessions';
import { users } from './users';

/**
 * Tracks every webinar registrant — both enrolled students who auto-register
 * via our app AND external attendees who fill the Zoom-hosted form.
 *
 * Populated by:
 *   • `webinar.registration_created` webhook (canonical source of truth)
 *   • Our auto-registration endpoint as an immediate write-through
 *     (avoids a brief gap before the webhook arrives)
 *
 * `userId` is NULL for external attendees who don't have a system account.
 * `(sessionId, email)` is unique — Zoom dedupes by email per webinar, so we
 * mirror that here.
 */
export const webinarRegistrations = pgTable(
  'webinar_registrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

    // Registrant details — snapshot at registration time; we don't keep
    // them in sync with the users table on purpose (record-of-truth here).
    email: varchar('email', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    phone: varchar('phone', { length: 50 }),
    nationalId: varchar('national_id', { length: 50 }),
    scfhsNumber: varchar('scfhs_number', { length: 50 }),

    // Zoom-side identifiers — opaque IDs we get back from POST .../registrants
    zoomRegistrantId: varchar('zoom_registrant_id', { length: 100 }),
    joinUrl: text('join_url'),

    // Lifecycle. Zoom emits status updates; we mirror them. 'approved' is
    // the default since our webinars are configured for automatic approval.
    status: varchar('status', { length: 20 }).notNull().default('approved'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('webinar_registrations_session_id_idx').on(table.sessionId),
    index('webinar_registrations_user_id_idx').on(table.userId),
    index('webinar_registrations_email_idx').on(table.email),
    unique('webinar_registrations_session_email_unique').on(table.sessionId, table.email),
  ],
);

export const webinarRegistrationsRelations = relations(webinarRegistrations, ({ one }) => ({
  session: one(sessions, {
    fields: [webinarRegistrations.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [webinarRegistrations.userId],
    references: [users.id],
  }),
}));

export type WebinarRegistration = typeof webinarRegistrations.$inferSelect;
export type NewWebinarRegistration = typeof webinarRegistrations.$inferInsert;
