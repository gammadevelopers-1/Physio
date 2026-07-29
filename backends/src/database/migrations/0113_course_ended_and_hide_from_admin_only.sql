-- Course lifecycle rework (Amna spec, 2026-07):
--
-- 1) Introduce an `ended` status between `active` and `completed`. The
--    course-completion cron now flips end-date-expired courses to `ended`
--    instead of `completed`, so certificates / CME awards / xAPI
--    completion / student reviews stay locked until a manager or admin
--    explicitly clicks Mark Completed. Prevents the calendar from firing
--    irreversible compliance artefacts on courses that still need review.
--
-- 2) Add `hide_from_admin_only` — a soft-delete flavor flag. Set to TRUE
--    when the archive-then-delete path removes a course; that hides the
--    row from admin / manager / instructor listings but keeps student
--    certificate + verification routes resolving so learners retain
--    their CME evidence after admins clean up the course roster.
--    Left FALSE by every other delete path (ended-course deletion fully
--    hides the row from everyone) and by not-yet-deleted rows.

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_status_check;
ALTER TABLE courses ADD CONSTRAINT courses_status_check
  CHECK (status IN (
    'draft',
    'pending_review',
    'changes_requested',
    'active',
    'ended',
    'completed',
    'archived',
    'cancelled'
  ));

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS hide_from_admin_only boolean NOT NULL DEFAULT false;
