-- Enrollments audit columns for admin/manager manual enrollment + removal.
--
-- Amna: managers/admins can manually enroll any platform student into any
-- course (paid or free) with a reason, and remove them with a reason.
-- Finance later reviews the removal reason to decide whether to refund.
--
-- Additive-only, safe on live data:
--   • enrolled_by      — who added this enrollment (student = self-enroll;
--                        NULL for legacy rows and self-service enrollments
--                        that pre-date this column; admin/manager id when
--                        manually enrolled)
--   • enrollment_reason — free-text reason captured at manual enrollment.
--                        NULL for self-service enrollments.
--   • removed_by       — admin/manager who removed the student. NULL until
--                        removal happens.
--   • removed_at       — timestamp of the removal action. NULL until removed.
--   • removal_reason   — mandatory-at-service-layer reason. Finance reads
--                        this to decide refund. NULL until removed.
--
-- The `dropped` status already exists in the enrollments_status_check enum;
-- removal sets status = 'dropped' PLUS populates these audit columns so we
-- can distinguish an admin removal from a student self-drop.

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS enrolled_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS enrollment_reason VARCHAR(500),
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS removal_reason VARCHAR(500);

CREATE INDEX IF NOT EXISTS enrollments_enrolled_by_idx ON enrollments(enrolled_by);
CREATE INDEX IF NOT EXISTS enrollments_removed_by_idx ON enrollments(removed_by);
CREATE INDEX IF NOT EXISTS enrollments_removed_at_idx ON enrollments(removed_at);
