-- PDPL Article 12 (Right to Erasure) — soft-delete columns on users
--
-- deleted_at: NULL for active users, timestamp when user requested deletion.
--   The row remains for a 30-day grace period so the user can cancel.
-- deletion_reason: optional free-text captured at request time for audit.
--
-- Hard deletion is a separate operational step (admin-only) because 68
-- tables have FK references to users; each cascade needs individual audit.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletion_reason" text;

-- Fast filter for the daily grace-period cron
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users" ("deleted_at")
  WHERE "deleted_at" IS NOT NULL;
