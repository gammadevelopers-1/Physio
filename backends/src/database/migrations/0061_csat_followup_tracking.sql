-- Migration 0061: CSAT follow-up tracking.
--
-- When a detractor (score 1-2) submits a CSAT response, the system
-- already fires an auto-email apology. That's the *automatic* layer.
--
-- This migration adds the *manual* layer: two columns that let
-- supervisors mark a low-rating survey as "we reached out to this
-- person" and capture WHO did the outreach and WHEN. Powers the
-- Low-Rating Follow-up panel in Reports, where supervisors split
-- detractors into "needs follow-up" vs "followed up" with a single
-- click.
--
-- Both columns are NULL by default → every existing low-rating
-- survey naturally lands in the "needs follow-up" bucket on first
-- load, which is the desired behaviour (supervisors triage from
-- scratch rather than the system silently marking history as done).

ALTER TABLE "csat_surveys"
  ADD COLUMN IF NOT EXISTS "follow_up_completed_at" TIMESTAMP;

ALTER TABLE "csat_surveys"
  ADD COLUMN IF NOT EXISTS "follow_up_completed_by" UUID
  REFERENCES "users"("id") ON DELETE SET NULL;

-- Hot path: the "needs follow-up" list scans surveys with score ≤ 2
-- AND follow_up_completed_at IS NULL. Partial index keeps the scan
-- tight even as the surveys table grows.
CREATE INDEX IF NOT EXISTS "csat_surveys_pending_followup_idx"
  ON "csat_surveys" ("score")
  WHERE "score" IS NOT NULL
    AND "score" <= 2
    AND "follow_up_completed_at" IS NULL;
