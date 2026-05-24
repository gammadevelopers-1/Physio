import {
  pgTable,
  varchar,
  jsonb,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Platform-wide settings, one row per category. The JSONB shape per
 * row is documented inside [[settings.service.ts]] — keep it loose
 * here so we can evolve each section without migrations.
 *
 * Categories currently used: general, localization, auth, payments,
 * notifications, maintenance.
 */
export const systemSettings = pgTable('system_settings', {
  category: varchar('category', { length: 64 }).primaryKey(),
  value: jsonb('value').notNull().default({}),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id, {
    onDelete: 'set null',
  }),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
