import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  primaryKey,
  text,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

// Permission matrix shape stored per role in `roles.permissions`.
// Keys are categories rendered in the admin Roles page; each maps to
// CRUD flags. New categories can be added without a migration — the
// frontend treats missing keys as all-false.
export const PERMISSION_CATEGORIES = [
  'users',
  'courses',
  'content',
  'assessments',
  'certificates',
  'finance',
  'reports',
  'settings',
  'security',
] as const;
export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];
export interface PermissionFlags {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}
export type RolePermissions = Partial<Record<PermissionCategory, PermissionFlags>>;

// ===========================================
// Roles Table - Predefined system roles
// ===========================================
export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  description: text('description'),
  permissions: jsonb('permissions').$type<RolePermissions>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ===========================================
// User Roles Junction Table - Many-to-Many
// ===========================================
export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at').defaultNow().notNull(),
    assignedBy: uuid('assigned_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    supportSubRole: varchar('support_sub_role', { length: 20 }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.roleId] }),
  }),
);

// ===========================================
// Relations
// ===========================================
export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  assignedByUser: one(users, {
    fields: [userRoles.assignedBy],
    references: [users.id],
  }),
}));

// ===========================================
// Type Exports
// ===========================================
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type UserRoleAssignment = typeof userRoles.$inferSelect;
export type NewUserRoleAssignment = typeof userRoles.$inferInsert;

// Predefined role names (for type safety)
export const ROLE_NAMES = {
  STUDENT: 'STUDENT',
  INSTRUCTOR: 'INSTRUCTOR',
  TEACHING_ASSISTANT: 'TEACHING_ASSISTANT',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
  FINANCE: 'FINANCE',
  SUPPORT: 'SUPPORT',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

export const SUPPORT_SUB_ROLES = {
  SUPERVISOR: 'supervisor',
  AGENT: 'agent',
} as const;

export type SupportSubRole =
  (typeof SUPPORT_SUB_ROLES)[keyof typeof SUPPORT_SUB_ROLES];
