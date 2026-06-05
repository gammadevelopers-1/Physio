import {
  pgTable,
  uuid,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// ===========================================
// Support Team Members
// One row per (supervisor, agent) link. An agent belongs to at most one
// supervisor at a time — enforced by the unique index on agent_id.
// ===========================================
export const supportTeamMembers = pgTable(
  'support_team_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supervisorId: uuid('supervisor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Admin who approved the request that created this membership. Null
    // if seeded directly (e.g. via DB script).
    addedBy: uuid('added_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  },
  (table) => [
    // Agent can only be on one team at a time.
    index('support_team_members_agent_unique').on(table.agentId),
    index('support_team_members_supervisor_idx').on(table.supervisorId),
  ],
);

export const supportTeamMembersRelations = relations(
  supportTeamMembers,
  ({ one }) => ({
    supervisor: one(users, {
      fields: [supportTeamMembers.supervisorId],
      references: [users.id],
      relationName: 'teamSupervisor',
    }),
    agent: one(users, {
      fields: [supportTeamMembers.agentId],
      references: [users.id],
      relationName: 'teamAgent',
    }),
  }),
);

export type SupportTeamMember = typeof supportTeamMembers.$inferSelect;
export type NewSupportTeamMember = typeof supportTeamMembers.$inferInsert;
