-- ─── Add session reschedule tracking columns ───────────────────────
-- The drizzle schema has declared `rescheduleReason` / `rescheduledToId`
-- on the sessions table and a widened status check constraint, but the
-- columns/constraint were never pushed to any environment that existed
-- before this file. Adds them idempotently so the course-manager
-- dashboard query (SessionsService.findToday via InstructorService
-- .getDashboardSummary) stops throwing "column does not exist".

ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "reschedule_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "rescheduled_to_id" UUID;

-- Add self-referential FK only if not already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sessions_rescheduled_to_id_sessions_id_fk'
  ) THEN
    ALTER TABLE "sessions"
      ADD CONSTRAINT "sessions_rescheduled_to_id_sessions_id_fk"
      FOREIGN KEY ("rescheduled_to_id") REFERENCES "sessions"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

-- Widen the status check constraint to include new values.
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_status_check";
ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_status_check"
  CHECK ("status" IN ('scheduled','live','ended','completed','cancelled','missed','rescheduled'));
