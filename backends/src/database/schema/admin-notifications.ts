import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';

// ===========================================
// Admin Notifications - Real-time alerts
// ===========================================
export const adminNotifications = pgTable('admin_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Notification type: 'critical' | 'warning' | 'info'
  type: varchar('type', { length: 20 }).notNull().default('info'),

  // Pre-rendered fallback text. Writers should prefer titleKey / descriptionKey
  // so the client can localize; these remain for legacy rows and for cases
  // where the source text is inherently untranslatable (e.g. Sentry payloads).
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),

  // i18n key + interpolation params. When present, the client renders
  // t(titleKey, titleParams) instead of the raw title.
  titleKey: varchar('title_key', { length: 120 }),
  titleParams: jsonb('title_params').$type<Record<string, string | number>>(),
  descriptionKey: varchar('description_key', { length: 120 }),
  descriptionParams: jsonb('description_params').$type<Record<string, string | number>>(),

  // Optional link (e.g., to the role request review page)
  link: varchar('link', { length: 500 }),

  // Read status
  isRead: boolean('is_read').notNull().default(false),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Type exports
export type AdminNotification = typeof adminNotifications.$inferSelect;
export type NewAdminNotification = typeof adminNotifications.$inferInsert;
