import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// Tracks the last time a user "saw" a given sidebar tab. Powers the
// sidebar alert badges across every dashboard — the badge for a tab
// counts items created/changed since the user's row here. Visiting
// the tab bumps viewed_at = now() so the badge clears naturally.
//
// One row per (user, tabKey). tab_key is a stable string identifier
// owned by the API (e.g. "tickets:mine", "applications", "alerts").
export const sidebarViews = pgTable(
  'sidebar_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tabKey: varchar('tab_key', { length: 64 }).notNull(),
    viewedAt: timestamp('viewed_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('sidebar_views_user_tab_unique').on(table.userId, table.tabKey),
    index('sidebar_views_user_id_idx').on(table.userId),
  ],
);

export const sidebarViewsRelations = relations(sidebarViews, ({ one }) => ({
  user: one(users, {
    fields: [sidebarViews.userId],
    references: [users.id],
  }),
}));

export type SidebarView = typeof sidebarViews.$inferSelect;
export type NewSidebarView = typeof sidebarViews.$inferInsert;
