-- Migration 0056: Cron run health log
--
-- Each scheduled job writes a row when it finishes (success or error)
-- so the admin Support Overview can show "last run X seconds ago" per
-- cron and an at-a-glance status strip. We keep a small rolling history
-- (the latest N rows per cron_name); the overview query reads only the
-- most recent row per name.
--
-- Append-only table — no UPDATE pattern. A future job can prune rows
-- older than 30 days if size matters.

CREATE TABLE IF NOT EXISTS "cron_runs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable identifier for the cron (e.g. "SLA_BREACH_CHECK",
  -- "BUSINESS_RESUME_SWEEP"). Not a user-facing label — the FE maps
  -- it to a translated display name.
  "cron_name" VARCHAR(64) NOT NULL,
  "started_at" TIMESTAMP NOT NULL DEFAULT now(),
  "finished_at" TIMESTAMP,
  "status" VARCHAR(16) NOT NULL DEFAULT 'running',
  -- Duration in milliseconds. NULL while running, populated on finish.
  "duration_ms" INTEGER,
  -- Truncated error message when status = 'error'. NULL otherwise.
  "error_message" VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS "cron_runs_name_started_idx"
  ON "cron_runs" ("cron_name", "started_at" DESC);
