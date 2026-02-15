import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

// ===========================================
// Admin Notifications - Real-time alerts
// ===========================================
export const adminNotifications = pgTable('admin_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Notification type: 'critical' | 'warning' | 'info'
  type: varchar('type', { length: 20 }).notNull().default('info'),

  // Title and description
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),

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
