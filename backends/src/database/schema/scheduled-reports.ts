import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';

export const scheduledReports = pgTable(
  'scheduled_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reportType: varchar('report_type', { length: 30 }).notNull(),
    format: varchar('format', { length: 10 }).notNull().default('csv'),
    courseId: uuid('course_id'), // optional — null means all courses
    frequency: varchar('frequency', { length: 20 }).notNull(), // daily, weekly, monthly
    enabled: boolean('enabled').notNull().default(true),
    lastRunAt: timestamp('last_run_at'),
    nextRunAt: timestamp('next_run_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('scheduled_reports_user_id_idx').on(table.userId),
    index('scheduled_reports_enabled_idx').on(table.enabled),
    check(
      'scheduled_reports_frequency_check',
      sql`${table.frequency} IN ('daily', 'weekly', 'monthly')`,
    ),
    check(
      'scheduled_reports_format_check',
      sql`${table.format} IN ('csv', 'pdf', 'xlsx')`,
    ),
  ],
);

export const scheduledReportsRelations = relations(
  scheduledReports,
  ({ one }) => ({
    user: one(users, {
      fields: [scheduledReports.userId],
      references: [users.id],
    }),
  }),
);

export type ScheduledReport = typeof scheduledReports.$inferSelect;
export type NewScheduledReport = typeof scheduledReports.$inferInsert;

export const REPORT_FREQUENCY = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const;

export type ReportFrequency =
  (typeof REPORT_FREQUENCY)[keyof typeof REPORT_FREQUENCY];
