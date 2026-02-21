import {
  pgTable,
  uuid,
  varchar,
  bigint,
  integer,
  timestamp,
  index,
  check,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { courses } from './courses';
import { courseModules } from './course-modules';
import { users } from './users';

export const courseMaterials = pgTable(
  'course_materials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    moduleId: uuid('module_id').references(() => courseModules.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 255 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    fileUrl: varchar('file_url', { length: 500 }),
    fileSize: bigint('file_size', { mode: 'number' }),
    mimeType: varchar('mime_type', { length: 100 }),
    version: integer('version').notNull().default(1),
    previousVersionId: uuid('previous_version_id'),
    orderIndex: integer('order_index').notNull().default(0),
    status: varchar('status', { length: 20 }).notNull().default('processing'),
    wcagStatus: varchar('wcag_status', { length: 20 }).notNull().default('pending'),
    captionsUrl: varchar('captions_url', { length: 500 }),
    transcriptUrl: varchar('transcript_url', { length: 500 }),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    // Self-referential FK for versioning
    foreignKey({
      columns: [table.previousVersionId],
      foreignColumns: [table.id],
      name: 'course_materials_previous_version_fk',
    }),
    index('course_materials_course_id_idx').on(table.courseId),
    index('course_materials_module_id_idx').on(table.moduleId),
    index('course_materials_type_idx').on(table.type),
    index('course_materials_status_idx').on(table.status),
    index('course_materials_uploaded_by_idx').on(table.uploadedBy),
    index('course_materials_module_order_idx').on(table.moduleId, table.orderIndex),
    check(
      'course_materials_type_check',
      sql`${table.type} IN ('video', 'pdf', 'document', 'image')`,
    ),
    check(
      'course_materials_status_check',
      sql`${table.status} IN ('processing', 'live', 'failed')`,
    ),
  ],
);

export const courseMaterialsRelations = relations(
  courseMaterials,
  ({ one }) => ({
    course: one(courses, {
      fields: [courseMaterials.courseId],
      references: [courses.id],
    }),
    module: one(courseModules, {
      fields: [courseMaterials.moduleId],
      references: [courseModules.id],
    }),
    uploader: one(users, {
      fields: [courseMaterials.uploadedBy],
      references: [users.id],
    }),
  }),
);

export type CourseMaterial = typeof courseMaterials.$inferSelect;
export type NewCourseMaterial = typeof courseMaterials.$inferInsert;

export const MATERIAL_TYPE = {
  VIDEO: 'video',
  PDF: 'pdf',
  DOCUMENT: 'document',
  IMAGE: 'image',
} as const;

export type MaterialType =
  (typeof MATERIAL_TYPE)[keyof typeof MATERIAL_TYPE];

export const MATERIAL_STATUS = {
  PROCESSING: 'processing',
  LIVE: 'live',
  FAILED: 'failed',
} as const;

export type MaterialStatus =
  (typeof MATERIAL_STATUS)[keyof typeof MATERIAL_STATUS];
