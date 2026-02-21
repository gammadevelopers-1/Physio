import {
  pgTable,
  uuid,
  varchar,
  bigint,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { courseMaterials } from './course-materials';

export const materialVariants = pgTable(
  'material_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    materialId: uuid('material_id')
      .notNull()
      .references(() => courseMaterials.id, { onDelete: 'cascade' }),
    resolution: varchar('resolution', { length: 10 }).notNull(),
    fileUrl: varchar('file_url', { length: 500 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }),
    width: bigint('width', { mode: 'number' }),
    height: bigint('height', { mode: 'number' }),
    bitrate: varchar('bitrate', { length: 20 }),
    mimeType: varchar('mime_type', { length: 100 }).notNull().default('video/mp4'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('material_variants_material_id_idx').on(table.materialId),
    index('material_variants_resolution_idx').on(table.materialId, table.resolution),
  ],
);

export const materialVariantsRelations = relations(
  materialVariants,
  ({ one }) => ({
    material: one(courseMaterials, {
      fields: [materialVariants.materialId],
      references: [courseMaterials.id],
    }),
  }),
);

export type MaterialVariant = typeof materialVariants.$inferSelect;
export type NewMaterialVariant = typeof materialVariants.$inferInsert;
