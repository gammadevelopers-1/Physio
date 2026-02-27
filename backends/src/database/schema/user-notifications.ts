import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// ===========================================
// User Notifications - In-app notification bell
// ===========================================
export const userNotifications = pgTable(
  'user_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Recipient (cascade delete when user is removed)
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Notification type
    type: varchar('type', { length: 30 }).notNull(),

    // Content
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),

    // Optional deep link path
    link: varchar('link', { length: 500 }),

    // Read status
    isRead: boolean('is_read').notNull().default(false),

    // Optional entity reference
    entityType: varchar('entity_type', { length: 50 }),
    entityId: uuid('entity_id'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('user_notif_recipient_idx').on(table.recipientId),
    index('user_notif_recipient_read_idx').on(table.recipientId, table.isRead),
    index('user_notif_created_idx').on(table.createdAt),
  ],
);

// Type exports
export type UserNotification = typeof userNotifications.$inferSelect;
export type NewUserNotification = typeof userNotifications.$inferInsert;
