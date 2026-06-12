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
import { tickets } from './tickets';

// ─── Support Macros ──────────────────────────────────────────

export const supportMacros = pgTable(
  'support_macros',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: varchar('title', { length: 200 }).notNull(),
    bodyTemplate: text('body_template').notNull(),
    bodyAr: text('body_ar'),
    // Slug of a ticket category (matches the slugs returned by
    // listTicketCategories — builtins + custom). NULL means the
    // macro is general-purpose and shows in every ticket's dropdown.
    categoryKey: varchar('category_key', { length: 50 }),
    variables: json('variables').$type<string[]>(),
    kbArticleUrls: json('kb_article_urls').$type<string[]>(),
    // Nullable to support system-seeded starter macros (created_by
    // is NULL for those). ON DELETE SET NULL so removing a former
    // staff member doesn't wipe the macros they authored.
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('support_macros_created_by_idx').on(table.createdBy),
    index('support_macros_category_key_idx').on(table.categoryKey),
    index('support_macros_is_active_idx').on(table.isActive),
  ],
);

// ─── Macro usage events ─────────────────────────────────────
//
// One row per apply (matches the kb_search_events pattern). Powers
// the usage analytics panel: top-used macros, untouched macros,
// monthly trend, per-agent reliance. Cheap to write, easy to
// aggregate, and we keep the full history rather than denormalised
// counters so reports can slice arbitrarily.

export const supportMacroUses = pgTable(
  'support_macro_uses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    macroId: uuid('macro_id')
      .notNull()
      .references(() => supportMacros.id, { onDelete: 'cascade' }),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    appliedAt: timestamp('applied_at').defaultNow().notNull(),
  },
  (table) => [
    index('support_macro_uses_macro_id_idx').on(table.macroId),
    index('support_macro_uses_user_id_idx').on(table.userId),
    index('support_macro_uses_applied_at_idx').on(table.appliedAt),
  ],
);

// ─── Relations ──────────────────────────────────────────

export const supportMacrosRelations = relations(supportMacros, ({ one, many }) => ({
  creator: one(users, {
    fields: [supportMacros.createdBy],
    references: [users.id],
  }),
  uses: many(supportMacroUses),
}));

export const supportMacroUsesRelations = relations(supportMacroUses, ({ one }) => ({
  macro: one(supportMacros, {
    fields: [supportMacroUses.macroId],
    references: [supportMacros.id],
  }),
  ticket: one(tickets, {
    fields: [supportMacroUses.ticketId],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [supportMacroUses.userId],
    references: [users.id],
  }),
}));

// ─── Types ──────────────────────────────────────────

export type SupportMacro = typeof supportMacros.$inferSelect;
export type NewSupportMacro = typeof supportMacros.$inferInsert;
export type SupportMacroUse = typeof supportMacroUses.$inferSelect;
export type NewSupportMacroUse = typeof supportMacroUses.$inferInsert;
