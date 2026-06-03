import {
  pgTable,
  uuid,
  varchar,
  text,
  json,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { escalationPaths } from './escalation-paths';

// ─── Support Macros ──────────────────────────────────────────

export const supportMacros = pgTable(
  'support_macros',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 200 }).notNull(),
    bodyTemplate: text('body_template').notNull(),
    variables: json('variables').$type<string[]>(),
    kbArticleUrls: json('kb_article_urls').$type<string[]>(),
    escalationPathId: uuid('escalation_path_id').references(
      () => escalationPaths.id,
      { onDelete: 'set null' },
    ),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('support_macros_created_by_idx').on(table.createdBy)],
);

// ─── Relations ──────────────────────────────────────────

export const supportMacrosRelations = relations(supportMacros, ({ one }) => ({
  creator: one(users, {
    fields: [supportMacros.createdBy],
    references: [users.id],
  }),
  escalationPath: one(escalationPaths, {
    fields: [supportMacros.escalationPathId],
    references: [escalationPaths.id],
  }),
}));

// ─── Types ──────────────────────────────────────────

export type SupportMacro = typeof supportMacros.$inferSelect;
export type NewSupportMacro = typeof supportMacros.$inferInsert;
