import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// One row per public KB search. See migration 0052 for the rationale —
// short version: this is for "what are people searching for and what
// returns nothing", not user behaviour tracking.
export const kbSearchEvents = pgTable(
  'kb_search_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    query: varchar('query', { length: 200 }).notNull(),
    locale: varchar('locale', { length: 5 }).notNull(),
    resultsCount: integer('results_count').notNull(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    searchedAt: timestamp('searched_at').notNull().defaultNow(),
  },
  (table) => [
    index('kb_search_events_query_idx').on(table.query),
    index('kb_search_events_searched_at_idx').on(table.searchedAt),
  ],
);

export type KbSearchEvent = typeof kbSearchEvents.$inferSelect;
export type NewKbSearchEvent = typeof kbSearchEvents.$inferInsert;
