import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

// Append-only log of scheduled job runs. See migration 0056 — used by
// the admin Support Overview to render a per-cron status strip
// ("last run X seconds ago"). The most recent row per cron_name is
// authoritative; older rows are kept for short-term history but the
// dashboard only reads the latest.

export const cronRuns = pgTable(
  'cron_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cronName: varchar('cron_name', { length: 64 }).notNull(),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    finishedAt: timestamp('finished_at'),
    status: varchar('status', { length: 16 }).notNull().default('running'),
    durationMs: integer('duration_ms'),
    errorMessage: varchar('error_message', { length: 500 }),
  },
  (table) => [index('cron_runs_name_started_idx').on(table.cronName, table.startedAt)],
);

export type CronRun = typeof cronRuns.$inferSelect;
export type NewCronRun = typeof cronRuns.$inferInsert;
