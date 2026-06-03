import { pgTable, varchar, json, timestamp } from 'drizzle-orm/pg-core';

// ─── Support Config (key-value store for system state) ──────

export const supportConfig = pgTable('support_config', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: json('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type SupportConfigRow = typeof supportConfig.$inferSelect;
