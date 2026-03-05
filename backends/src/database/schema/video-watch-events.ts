import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { courseMaterials } from './course-materials';
import { users } from './users';

export const videoWatchEvents = pgTable(
  'video_watch_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    materialId: uuid('material_id')
      .notNull()
      .references(() => courseMaterials.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 20 }).notNull(),
    position: integer('position').notNull(),
    fromPosition: integer('from_position'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('vwe_material_id_idx').on(table.materialId),
    index('vwe_student_id_idx').on(table.studentId),
    index('vwe_material_event_idx').on(table.materialId, table.eventType),
    check(
      'video_watch_events_type_check',
      sql`${table.eventType} IN ('play','pause','seek','heartbeat','complete','buffer')`,
    ),
  ],
);

export const videoWatchEventsRelations = relations(videoWatchEvents, ({ one }) => ({
  material: one(courseMaterials, {
    fields: [videoWatchEvents.materialId],
    references: [courseMaterials.id],
  }),
  student: one(users, {
    fields: [videoWatchEvents.studentId],
    references: [users.id],
  }),
}));

export type VideoWatchEvent = typeof videoWatchEvents.$inferSelect;
export type NewVideoWatchEvent = typeof videoWatchEvents.$inferInsert;
