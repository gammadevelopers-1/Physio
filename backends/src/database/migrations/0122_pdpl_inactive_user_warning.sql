-- PDPL Article 18 (Storage Limitation) — inactive user handling
--
-- inactive_warned_at: timestamp when the user was emailed a 30-day
--   deletion-warning notice. Set once by the retention cron so we do
--   not re-warn every night; cleared if the user logs back in (in
--   auth.service.ts login flow).
--
-- Policy (client-approved, 2026-08-16):
--   threshold  = 24 months since last login
--   grace      = 30 days between warning and hard-delete
--   exemptions = paid enrollments, issued certs, pending refunds,
--                blocked users, non-STUDENT roles
--   comms      = warning email + 7-day reminder + final delete

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inactive_warned_at" timestamp;

-- Fast filter for the nightly warn/delete queries (partial index —
-- only warned users are ever scanned for the delete pass).
CREATE INDEX IF NOT EXISTS "users_inactive_warned_at_idx"
  ON "users" ("inactive_warned_at")
  WHERE "inactive_warned_at" IS NOT NULL;

-- Fast filter for the warning query: last_login_at is queried against
-- "> 24 months ago" nightly. If not already indexed, this helps.
CREATE INDEX IF NOT EXISTS "users_last_login_at_idx"
  ON "users" ("last_login_at")
  WHERE "last_login_at" IS NOT NULL;
