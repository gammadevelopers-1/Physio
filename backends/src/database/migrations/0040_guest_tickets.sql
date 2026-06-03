-- Migration: Guest Ticket System
-- Sentinel guest user + tracking token + guest contact fields

-- 1. Create sentinel guest user (used as studentId for guest tickets)
INSERT INTO "users" ("id", "email", "password_hash", "first_name", "last_name", "active_role", "is_active", "is_verified")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'guest@system.internal',
  '$argon2id$v=19$m=65536,t=3,p=4$notarealusernopassword$notarealusernopassword',
  'Guest',
  'User',
  'STUDENT',
  true,
  true
) ON CONFLICT ("id") DO NOTHING;

-- 2. Add guest ticket columns
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "guest_tracking_token" VARCHAR(100) UNIQUE;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "guest_name" VARCHAR(100);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "guest_email" VARCHAR(255);

-- 3. Index for fast token lookups
CREATE UNIQUE INDEX IF NOT EXISTS "tickets_guest_token_idx"
  ON "tickets" ("guest_tracking_token")
  WHERE "guest_tracking_token" IS NOT NULL;
