-- pre_archive_status captures the status a course held just before it
-- was archived. On unarchive we restore to this value (fallback: active)
-- so the lifecycle is symmetric — ended → archived → unarchive returns
-- to ended, completed → archived → unarchive returns to completed.
--
-- Client spec Amna 2026-08: archived is a shelf, not a state reset.
-- Existing archived rows have NULL pre_archive_status, meaning legacy
-- behaviour (unarchive → active) applies to them.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS pre_archive_status varchar(20);

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_pre_archive_status_check;
ALTER TABLE courses ADD CONSTRAINT courses_pre_archive_status_check
  CHECK (pre_archive_status IS NULL OR pre_archive_status IN (
    'draft',
    'pending_review',
    'changes_requested',
    'active',
    'ended',
    'completed',
    'archived',
    'cancelled'
  ));
