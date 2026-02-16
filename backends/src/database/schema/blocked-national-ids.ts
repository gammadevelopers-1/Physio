import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// ===========================================
// Blocked National IDs - Prevent reapplication
// ===========================================
export const blockedNationalIds = pgTable('blocked_national_ids', {
  id: uuid('id').primaryKey().defaultRandom(),

  // The blocked national/iqama ID (unique)
  nationalId: varchar('national_id', { length: 50 }).notNull().unique(),

  // Reason for blocking
  reason: text('reason').notNull(),

  // Who blocked it
  blockedBy: uuid('blocked_by')
    .notNull()
    .references(() => users.id, { onDelete: 'set null' }),

  // Timestamps
  blockedAt: timestamp('blocked_at').defaultNow().notNull(),
});

// Type exports
export type BlockedNationalId = typeof blockedNationalIds.$inferSelect;
export type NewBlockedNationalId = typeof blockedNationalIds.$inferInsert;
