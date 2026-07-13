import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
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

    // Pre-rendered fallback text. Writers should prefer titleKey / messageKey
    // so the client can localize in the viewer's current UI locale; these
    // remain for legacy rows and inherently untranslatable payloads.
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),

    // i18n key + interpolation params. When present, the client renders
    // t(titleKey, titleParams) instead of the raw title.
    titleKey: varchar('title_key', { length: 120 }),
    titleParams: jsonb('title_params').$type<Record<string, string | number>>(),
    messageKey: varchar('message_key', { length: 120 }),
    messageParams: jsonb('message_params').$type<Record<string, string | number>>(),

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
