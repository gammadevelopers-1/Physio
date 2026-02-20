import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Basic info
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),

  // Profile
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  phone: varchar('phone', { length: 20 }),
  avatar: varchar('avatar', { length: 500 }),

  // Active Role - The currently selected role for multi-role users
  // This is stored as varchar to avoid circular dependency with roles table
  activeRole: varchar('active_role', { length: 50 }).notNull().default('STUDENT'),

  // Status
  isActive: boolean('is_active').notNull().default(true),
  isVerified: boolean('is_verified').notNull().default(false),

  // Security
  failedLoginAttempts: varchar('failed_login_attempts', { length: 10 }).default('0'),
  lockedUntil: timestamp('locked_until'),
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: varchar('last_login_ip', { length: 45 }),

  // Two-Factor Authentication
  twoFactorEnabled: boolean('two_factor_enabled').notNull().default(true),

  // Zoom Integration (optional — for matching Zoom participants to system users)
  zoomEmail: varchar('zoom_email', { length: 255 }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations will be defined in roles.ts to avoid circular imports

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = 'STUDENT' | 'INSTRUCTOR' | 'MANAGER' | 'ADMIN' | 'FINANCE' | 'SUPPORT' | 'SUPER_ADMIN';
