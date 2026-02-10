import { pgTable, uuid, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';

// Refresh tokens table
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),

  // User reference
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Token data
  token: varchar('token', { length: 500 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),

  // Device info (for "logged in devices" feature)
  deviceInfo: varchar('device_info', { length: 500 }),
  ipAddress: varchar('ip_address', { length: 45 }),

  // Revocation
  isRevoked: boolean('is_revoked').notNull().default(false),
  revokedAt: timestamp('revoked_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Type exports
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
