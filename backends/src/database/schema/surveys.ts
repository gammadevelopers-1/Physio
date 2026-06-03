import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  index,
  check,
  unique,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { tickets } from './tickets';
import { users } from './users';
import { courses } from './courses';

// ─── CSAT Surveys ──────────────────────────────────────────

export const csatSurveys = pgTable(
  'csat_surveys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').references(() => courses.id, {
      onDelete: 'set null',
    }),
    score: integer('score'),
    comment: text('comment'),
    channel: varchar('channel', { length: 20 }).notNull().default('email'),
    sentAt: timestamp('sent_at').defaultNow().notNull(),
    submittedAt: timestamp('submitted_at'),
  },
  (table) => [
    index('csat_surveys_ticket_id_idx').on(table.ticketId),
    index('csat_surveys_user_id_idx').on(table.userId),
    unique('csat_surveys_ticket_user_unique').on(table.ticketId, table.userId),
    check(
      'csat_score_check',
      sql`${table.score} IS NULL OR (${table.score} >= 1 AND ${table.score} <= 5)`,
    ),
    check(
      'csat_channel_check',
      sql`${table.channel} IN ('email', 'sms', 'whatsapp')`,
    ),
  ],
);

// ─── NPS Surveys ──────────────────────────────────────────

export const npsSurveys = pgTable(
  'nps_surveys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').references(() => courses.id, {
      onDelete: 'set null',
    }),
    score: integer('score'),
    comment: text('comment'),
    channel: varchar('channel', { length: 20 }).notNull().default('email'),
    sentAt: timestamp('sent_at').defaultNow().notNull(),
    submittedAt: timestamp('submitted_at'),
  },
  (table) => [
    index('nps_surveys_user_id_idx').on(table.userId),
    check(
      'nps_score_check',
      sql`${table.score} IS NULL OR (${table.score} >= 0 AND ${table.score} <= 10)`,
    ),
    check(
      'nps_channel_check',
      sql`${table.channel} IN ('email', 'sms', 'whatsapp')`,
    ),
  ],
);

// ─── Relations ──────────────────────────────────────────

export const csatSurveysRelations = relations(csatSurveys, ({ one }) => ({
  ticket: one(tickets, {
    fields: [csatSurveys.ticketId],
    references: [tickets.id],
  }),
  user: one(users, {
    fields: [csatSurveys.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [csatSurveys.courseId],
    references: [courses.id],
  }),
}));

export const npsSurveysRelations = relations(npsSurveys, ({ one }) => ({
  user: one(users, {
    fields: [npsSurveys.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [npsSurveys.courseId],
    references: [courses.id],
  }),
}));

// ─── Types ──────────────────────────────────────────

export type CsatSurvey = typeof csatSurveys.$inferSelect;
export type NewCsatSurvey = typeof csatSurveys.$inferInsert;
export type NpsSurvey = typeof npsSurveys.$inferSelect;
export type NewNpsSurvey = typeof npsSurveys.$inferInsert;
