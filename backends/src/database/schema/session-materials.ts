import {
  pgTable,
  uuid,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sessions } from './sessions';
import { courseMaterials } from './course-materials';
import { users } from './users';

export const sessionMaterials = pgTable(
  'session_materials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    materialId: uuid('material_id')
      .notNull()
      .references(() => courseMaterials.id, { onDelete: 'cascade' }),
    sharedBy: uuid('shared_by')
      .notNull()
      .references(() => users.id),
    sharedAt: timestamp('shared_at').defaultNow().notNull(),
  },
  (table) => [
    index('sm_session_id_idx').on(table.sessionId),
    uniqueIndex('sm_session_material_unique').on(table.sessionId, table.materialId),
  ],
);

export const sessionMaterialsRelations = relations(sessionMaterials, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionMaterials.sessionId],
    references: [sessions.id],
  }),
  material: one(courseMaterials, {
    fields: [sessionMaterials.materialId],
    references: [courseMaterials.id],
  }),
  sharer: one(users, {
    fields: [sessionMaterials.sharedBy],
    references: [users.id],
  }),
}));

export type SessionMaterial = typeof sessionMaterials.$inferSelect;
export type NewSessionMaterial = typeof sessionMaterials.$inferInsert;
