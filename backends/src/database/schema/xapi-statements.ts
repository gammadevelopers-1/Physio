import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users';
import { courses } from './courses';
import { enrollments } from './enrollments';

export const XAPI_STATEMENT_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
} as const;

export type XapiStatementStatus =
  (typeof XAPI_STATEMENT_STATUS)[keyof typeof XAPI_STATEMENT_STATUS];

export const xapiStatements = pgTable(
  'xapi_statements',
  {
    // Same UUID is sent in the statement body as xAPI `id`, making
    // retries idempotent on the LRS per the spec.
    id: uuid('id').primaryKey().defaultRandom(),
    verb: text('verb').notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    objectActivityId: text('object_activity_id').notNull(),
    objectType: text('object_type').notNull(),
    courseId: uuid('course_id').references(() => courses.id, {
      onDelete: 'set null',
    }),
    enrollmentId: uuid('enrollment_id').references(() => enrollments.id, {
      onDelete: 'set null',
    }),
    payload: jsonb('payload').notNull(),
    status: varchar('status', { length: 20 })
      .notNull()
      .default(XAPI_STATEMENT_STATUS.PENDING),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    sentAt: timestamp('sent_at'),
  },
  (table) => [
    index('idx_xapi_statements_status_created').on(
      table.status,
      table.createdAt,
    ),
    index('idx_xapi_statements_actor').on(table.actorUserId),
    index('idx_xapi_statements_course').on(table.courseId),
    index('idx_xapi_statements_verb').on(table.verb),
    index('idx_xapi_statements_created').on(table.createdAt),
    check(
      'xapi_statements_status_check',
      sql`${table.status} IN ('pending', 'sent', 'failed')`,
    ),
  ],
);

export const xapiStatementsRelations = relations(
  xapiStatements,
  ({ one, many }) => ({
    actor: one(users, {
      fields: [xapiStatements.actorUserId],
      references: [users.id],
    }),
    course: one(courses, {
      fields: [xapiStatements.courseId],
      references: [courses.id],
    }),
    enrollment: one(enrollments, {
      fields: [xapiStatements.enrollmentId],
      references: [enrollments.id],
    }),
    transmissions: many(xapiTransmissions),
  }),
);

export const xapiTransmissions = pgTable(
  'xapi_transmissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    statementId: uuid('statement_id')
      .notNull()
      .references(() => xapiStatements.id, { onDelete: 'cascade' }),
    attemptNo: integer('attempt_no').notNull(),
    httpStatus: integer('http_status'),
    responseBody: text('response_body'),
    errorText: text('error_text'),
    sentAt: timestamp('sent_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_xapi_transmissions_statement').on(table.statementId),
    index('idx_xapi_transmissions_sent').on(table.sentAt),
  ],
);

export const xapiTransmissionsRelations = relations(
  xapiTransmissions,
  ({ one }) => ({
    statement: one(xapiStatements, {
      fields: [xapiTransmissions.statementId],
      references: [xapiStatements.id],
    }),
  }),
);

export type XapiStatement = typeof xapiStatements.$inferSelect;
export type NewXapiStatement = typeof xapiStatements.$inferInsert;
export type XapiTransmission = typeof xapiTransmissions.$inferSelect;
export type NewXapiTransmission = typeof xapiTransmissions.$inferInsert;
