-- Expand refunds.reason CHECK to cover the buyer-side reason options the
-- refund modal now surfaces. Previously the list only offered generic
-- categories (policy / cancelled / technical / duplicate / other +
-- course_cancelled for admin-initiated). Amna's feedback: buyers need
-- more specific self-service reasons so finance can triage without
-- having to read the free-text note every time.
--
-- New values:
--   - description_mismatch  → "The course does not match the description"
--   - wrong_course          → "Incorrect course purchased"
--   - access_issue          → "Unable to access the course"
--
-- Additive widening only. Historical rows keep their existing values —
-- `policy` is preserved for backward compat even though the UI no longer
-- offers it (some archived refunds still carry it).
--
-- Column stays varchar(30); longest new value is 21 chars.

ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_reason_check;
ALTER TABLE refunds ADD CONSTRAINT refunds_reason_check
  CHECK (reason IN (
    'policy',
    'cancelled',
    'technical',
    'duplicate',
    'other',
    'course_cancelled',
    'description_mismatch',
    'wrong_course',
    'access_issue'
  ));
