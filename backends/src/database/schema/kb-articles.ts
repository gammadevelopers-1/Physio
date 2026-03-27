import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';

// ─── Knowledge Base Articles ──────────────────────────────────────────

export const kbArticles = pgTable(
  'kb_articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    titleAr: varchar('title_ar', { length: 300 }),
    titleEn: varchar('title_en', { length: 300 }),
    bodyAr: text('body_ar'),
    bodyEn: text('body_en'),
    category: varchar('category', { length: 30 }).notNull(),
    published: boolean('published').notNull().default(false),
    viewCount: integer('view_count').notNull().default(0),
    authorId: uuid('author_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('kb_articles_category_idx').on(table.category),
    index('kb_articles_published_idx').on(table.published),
    check(
      'kb_category_check',
      sql`${table.category} IN ('billing', 'login', 'content', 'certificate', 'technical', 'other')`,
    ),
  ],
);

// ─── Relations ──────────────────────────────────────────

export const kbArticlesRelations = relations(kbArticles, ({ one }) => ({
  author: one(users, {
    fields: [kbArticles.authorId],
    references: [users.id],
  }),
}));

// ─── Types ──────────────────────────────────────────

export type KbArticle = typeof kbArticles.$inferSelect;
export type NewKbArticle = typeof kbArticles.$inferInsert;
