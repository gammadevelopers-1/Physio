-- Course lifecycle Phase A foundation.
--
-- Prepares the schema for the full Cancel → Reschedule → Delete workflow that
-- Amna signed off on. No behavior changes yet — this is pure plumbing. Later
-- phases wire the actual services.
--
-- Rationale for each change is inline. All changes are additive except the
-- payments.courseId FK swap (CASCADE → RESTRICT), which tightens rather than
-- loosens: today's delete already blocks when payments exist, so no row can
-- legitimately trigger a cascade delete. RESTRICT just makes that guarantee
-- enforced by the database rather than by application code alone.

-- ─── Courses: add cancelled/rescheduled status + audit columns ──────────
-- Widen the status CHECK. `cancelled` is the new terminal-during-lifecycle
-- state; a cancelled course can either be rescheduled back to active or
-- stay cancelled forever (Amna: "if there are compliance records the
-- course cannot be deleted, only cancelled indefinitely").
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_status_check;
ALTER TABLE courses ADD CONSTRAINT courses_status_check
  CHECK (status IN ('draft', 'pending_review', 'changes_requested', 'active', 'completed', 'archived', 'cancelled'));

-- Cancellation audit columns. Mandatory reason is enforced at the service
-- layer (not DB-level) because there are legitimate cases where a NULL
-- reason lands (data migration, admin CLI). The service throws on empty.
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Reschedule audit columns. `original_start_date` snapshots the first
-- known start so we can show "originally started 2026-01-05" on the
-- rescheduled course card even after multiple reschedules move the date.
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reschedule_reason TEXT,
  ADD COLUMN IF NOT EXISTS original_start_date DATE;

CREATE INDEX IF NOT EXISTS courses_cancelled_at_idx ON courses(cancelled_at);

-- ─── Payments: tighten courseId FK ─────────────────────────────────────
-- Was ON DELETE CASCADE — meaning a hard course delete would silently
-- wipe payment history. Post-cancellation soft-delete is the only path
-- to removing a course now, and it always leaves payments intact by
-- construction. Swap to RESTRICT so any attempt to hard-delete a course
-- with payments is rejected at the DB layer, not just the service layer.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_course_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT;

-- ─── Payments: fix status CHECK drift ──────────────────────────────────
-- `abandoned` and `rejected` are written by the code today via `as any`
-- casts (payment-cleanup cron and Tamara cancel flow). Add them to the
-- CHECK so the drift is closed and future readers see the true state
-- space.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'processing', 'awaiting_approval', 'paid', 'failed', 'rejected', 'refunded', 'partially_refunded', 'chargeback', 'abandoned'));
