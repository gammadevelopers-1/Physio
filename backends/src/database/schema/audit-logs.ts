import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: varchar('entity_type', { length: 50 }).notNull(), // 'session', 'material', 'report', etc.
    entityId: uuid('entity_id').notNull(),
    action: varchar('action', { length: 50 }).notNull(), // 'created', 'started', 'ended', 'cancelled', etc.
    performedBy: uuid('performed_by').notNull().references(() => users.id),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    index('audit_logs_performed_by_idx').on(table.performedBy),
    index('audit_logs_created_at_idx').on(table.createdAt),
  ],
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  performer: one(users, {
    fields: [auditLogs.performedBy],
    references: [users.id],
  }),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
