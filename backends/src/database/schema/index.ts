// ===========================================
// Database Schema - Drizzle ORM
// ===========================================

// Auth schemas
export * from './users';
export * from './refresh-tokens';
export * from './roles';
export * from './two-factor';

// Health check (can remove later)
import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

export const healthCheck = pgTable('health_check', {
  id: uuid('id').primaryKey().defaultRandom(),
  checkedAt: timestamp('checked_at').defaultNow().notNull(),
  status: varchar('status', { length: 50 }).notNull().default('ok'),
});
