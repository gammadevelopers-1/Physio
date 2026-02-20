import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { sessions } from './sessions';
import { users } from './users';

export const sessionAssistants = pgTable(
  'session_assistants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: varchar('role', { length: 20 }).notNull().default('assistant'),
    assignedAt: timestamp('assigned_at').defaultNow().notNull(),
    assignedBy: uuid('assigned_by').references(() => users.id),
    isAutoAssigned: boolean('is_auto_assigned').notNull().default(false),
  },
  (table) => [
    uniqueIndex('session_assistants_session_user_unique').on(
      table.sessionId,
      table.userId,
    ),
    index('session_assistants_session_id_idx').on(table.sessionId),
    index('session_assistants_user_id_idx').on(table.userId),
    check(
      'session_assistants_role_check',
      sql`${table.role} IN ('co_host', 'assistant')`,
    ),
  ],
);

export const sessionAssistantsRelations = relations(
  sessionAssistants,
  ({ one }) => ({
    session: one(sessions, {
      fields: [sessionAssistants.sessionId],
      references: [sessions.id],
    }),
    user: one(users, {
      fields: [sessionAssistants.userId],
      references: [users.id],
    }),
    assigner: one(users, {
      fields: [sessionAssistants.assignedBy],
      references: [users.id],
    }),
  }),
);

export type SessionAssistant = typeof sessionAssistants.$inferSelect;
export type NewSessionAssistant = typeof sessionAssistants.$inferInsert;
