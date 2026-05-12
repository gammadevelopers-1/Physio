-- ===================================================================
-- Add instructor profile fields originally captured during the
-- trainer-application flow. Idempotent — safe to re-run.
-- ===================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS profession    VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS qualification VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS twitter       VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin      VARCHAR(500);
