import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  integer,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// ===========================================
// Trusted Devices Table
// ===========================================
// Stores browser/device fingerprints that have been verified via 2FA.
// Trusted devices skip OTP on subsequent logins.
export const trustedDevices = pgTable(
  'trusted_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    fingerprint: varchar('fingerprint', { length: 64 }).notNull(),
    deviceName: varchar('device_name', { length: 255 }),
    ipAddress: varchar('ip_address', { length: 45 }),

    lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('trusted_devices_user_fingerprint_idx').on(
      table.userId,
      table.fingerprint,
    ),
  ],
);

// ===========================================
// Two-Factor Challenges Table
// ===========================================
// Stores OTP challenges for email-based 2FA verification.
// Each challenge is a SHA-256 hashed 6-digit code with expiry and attempt tracking.
export const twoFactorChallenges = pgTable('two_factor_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),

  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  codeHash: varchar('code_hash', { length: 255 }).notNull(),
  fingerprint: varchar('fingerprint', { length: 64 }).notNull(),

  expiresAt: timestamp('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  isUsed: boolean('is_used').notNull().default(false),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Type exports
export type TrustedDevice = typeof trustedDevices.$inferSelect;
export type NewTrustedDevice = typeof trustedDevices.$inferInsert;
export type TwoFactorChallenge = typeof twoFactorChallenges.$inferSelect;
export type NewTwoFactorChallenge = typeof twoFactorChallenges.$inferInsert;
