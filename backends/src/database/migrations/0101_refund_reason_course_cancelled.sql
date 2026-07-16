-- Phase F bug 4: distinguish admin-initiated course cancellation refunds
-- from buyer-initiated `cancelled` refunds.
--
-- Before this migration the refunds.reason CHECK admitted:
--   'policy', 'cancelled', 'technical', 'duplicate', 'other'
-- Amna's Phase B cancel-course workflow was passing reason='cancelled'
-- which the finance UI labels "Buyer Changed Mind" — misleading, since
-- the refund was NOT buyer-initiated. Adding `course_cancelled` gives
-- the cancel workflow its own audit-honest label.
--
-- Safe additive widening: no existing row values change; CHECK constraint
-- is dropped and re-added with the extra value.

ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_reason_check;
ALTER TABLE refunds ADD CONSTRAINT refunds_reason_check
  CHECK (reason IN ('policy', 'cancelled', 'technical', 'duplicate', 'other', 'course_cancelled'));
