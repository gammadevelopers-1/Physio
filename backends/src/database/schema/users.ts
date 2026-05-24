import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  text,
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
  firstNameAr: varchar('first_name_ar', { length: 100 }),
  lastNameAr: varchar('last_name_ar', { length: 100 }),
  // Phone stored encrypted (AES-256-GCM via `encryptPII`). Type is `text`
  // because the ciphertext is ~3x longer than the plaintext. Legacy
  // plaintext rows remain readable; see common/crypto.ts.
  phone: text('phone'),
  avatar: varchar('avatar', { length: 500 }),

  // Extended profile
  bio: varchar('bio', { length: 1000 }),
  location: varchar('location', { length: 200 }),
  language: varchar('language', { length: 10 }).default('en'),

  // Learner profile fields. scfhsNumber + nationalId are PII — stored
  // encrypted at the application layer (see common/crypto.ts). Type is
  // `text` to hold the ciphertext. Legacy plaintext rows remain
  // readable until backfilled.
  scfhsNumber: text('scfhs_number'),
  nationalId: text('national_id'),
  nationality: varchar('nationality', { length: 100 }),
  gender: varchar('gender', { length: 20 }),
  dateOfBirth: varchar('date_of_birth', { length: 10 }),

  // Instructor-specific fields
  department: varchar('department', { length: 100 }),
  specialty: varchar('specialty', { length: 100 }),
  instructorStatus: varchar('instructor_status', { length: 20 }),
  // Profile fields originally captured during the trainer-application flow.
  // Surfaced to the instructor's settings page (editable) and the public
  // course detail page (read-only). Pre-filled from role_requests.profile_data
  // on approval; instructor edits sync back to admin via audit_logs + an
  // admin notification on every save.
  profession: varchar('profession', { length: 255 }),
  qualification: varchar('qualification', { length: 500 }),
  twitter: varchar('twitter', { length: 255 }),
  linkedin: varchar('linkedin', { length: 500 }),

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
export type UserRole = 'STUDENT' | 'INSTRUCTOR' | 'TEACHING_ASSISTANT' | 'MANAGER' | 'ADMIN' | 'FINANCE' | 'SUPPORT' | 'SUPER_ADMIN';
