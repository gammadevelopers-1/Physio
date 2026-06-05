import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { kbArticles } from './kb-articles';

// ─── Help Center Categories ──────────────────────────────────────
// Replaces the hardcoded CHECK constraint on kb_articles.category.
// Slug (string) lives on kb_articles for backwards compatibility with
// the existing rows; the slug is used as the foreign key.
export const kbCategories = pgTable(
  'kb_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 60 }).notNull().unique(),
    nameEn: varchar('name_en', { length: 120 }).notNull(),
    nameAr: varchar('name_ar', { length: 120 }),
    // lucide icon name (matches the icon registry on the frontend).
    icon: varchar('icon', { length: 40 }).notNull().default('BookOpen'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('kb_categories_sort_idx').on(table.sortOrder),
  ],
);

export const kbCategoriesRelations = relations(kbCategories, ({ many }) => ({
  articles: many(kbArticles),
}));

export type KbCategory = typeof kbCategories.$inferSelect;
export type NewKbCategory = typeof kbCategories.$inferInsert;
