import {
  pgTable,
  uuid,
  varchar,
  json,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

// ─── Escalation Paths ──────────────────────────────────────────

export interface EscalationStep {
  afterMinutes: number;
  assignToRole: string;
}

export const escalationPaths = pgTable('escalation_paths', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  steps: json('steps').$type<EscalationStep[]>().notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Types ──────────────────────────────────────────

export type EscalationPath = typeof escalationPaths.$inferSelect;
export type NewEscalationPath = typeof escalationPaths.$inferInsert;
