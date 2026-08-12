import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Immutable record of every consent action a user takes. One row per
 * (user, consentType, version) accepted at a specific moment. If the
 * user later withdraws (marketing opt-out), `withdrawnAt` is set on the
 * existing row rather than deleting it — regulators want the trail.
 *
 * consentType values (kept as varchar so operations can add new types
 * via config, not migration):
 *   - 'terms'            — Terms of Service acceptance
 *   - 'privacy'          — Privacy Policy acknowledgment
 *   - 'marketing_email'  — optional opt-in for marketing emails
 *
 * `version` is the identifier of the document as it was at the time of
 * acceptance (e.g. '2026-08-12'). If the platform substantially updates
 * Terms/Privacy, bumping the constant in consent-versions.ts triggers
 * re-acceptance on next login — the old row remains untouched as proof
 * of what was agreed to at signup time.
 */
export const userConsents = pgTable(
  'user_consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    consentType: varchar('consent_type', { length: 32 }).notNull(),
    version: varchar('version', { length: 32 }).notNull(),
    acceptedAt: timestamp('accepted_at').notNull().defaultNow(),
    withdrawnAt: timestamp('withdrawn_at'),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
  },
  (t) => ({
    userIdIdx: index('user_consents_user_id_idx').on(t.userId),
    typeIdx: index('user_consents_type_idx').on(t.consentType),
  }),
);
