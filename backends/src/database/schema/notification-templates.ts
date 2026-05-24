import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Admin-editable transactional message templates. The hardcoded
 * emails in mail.service.ts continue to work; this table is read
 * additively by the notification dispatcher when an event has a
 * matching (event_key, channel, locale) row enabled.
 *
 * Variables are `{{name}}`-style placeholders rendered at send time
 * from the event payload.
 */
export const notificationTemplates = pgTable(
  'notification_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventKey: varchar('event_key', { length: 128 }).notNull(),
    channel: varchar('channel', { length: 32 }).notNull(),
    locale: varchar('locale', { length: 8 }).notNull(),
    subject: text('subject'),
    preheader: text('preheader'),
    body: text('body').notNull(),
    /**
     * Unlayer (react-email-editor) design tree. Persisted so the admin
     * can re-open the template in the visual editor next session. Null
     * for WhatsApp templates and for legacy rows that predate the
     * visual editor.
     */
    designJson: jsonb('design_json'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => ({
    eventChannelLocaleUnique: uniqueIndex(
      'notification_templates_unique_key',
    ).on(table.eventKey, table.channel, table.locale),
  }),
);

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type NewNotificationTemplate =
  typeof notificationTemplates.$inferInsert;
