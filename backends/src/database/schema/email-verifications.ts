import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  integer,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Email verification codes for public flows (e.g., trainer applications)
 * where there's no logged-in user yet. Distinct from two_factor_challenges
 * which is keyed on userId.
 */
export const emailVerifications = pgTable(
  'email_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Normalized lowercase email being verified
    email: varchar('email', { length: 255 }).notNull(),

    // SHA-256 of the 6-digit code (never stored in plaintext)
    codeHash: varchar('code_hash', { length: 64 }).notNull(),

    // What this OTP is for. Lets us reuse this table for other public flows.
    // Currently only 'trainer-application'.
    purpose: varchar('purpose', { length: 50 }).notNull(),

    // 10-minute window
    expiresAt: timestamp('expires_at').notNull(),

    // Attempt counter — capped before issuing a new code
    attempts: integer('attempts').notNull().default(0),

    // Once verified or invalidated
    isUsed: boolean('is_used').notNull().default(false),

    // SHA-256 of submitter IP — used for rate-limiting without storing PII
    ipHash: varchar('ip_hash', { length: 64 }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    // Active codes lookup by email + purpose
    emailPurposeIdx: index('email_verifications_email_purpose_idx').on(
      table.email,
      table.purpose,
      table.isUsed,
    ),
    // Cleanup / rate-limit by created_at
    createdAtIdx: index('email_verifications_created_at_idx').on(
      table.createdAt,
    ),
  }),
);

export type EmailVerification = typeof emailVerifications.$inferSelect;
export type NewEmailVerification = typeof emailVerifications.$inferInsert;
