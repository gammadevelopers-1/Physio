-- ===========================================
-- Reconciliation drift types — Phase 2
-- ===========================================
-- Phase 2 adds three more scan shapes (Tamara webhook-recovery sweep, Tabby
-- webhook-recovery sweep, Bank Transfer internal consistency). They surface
-- four new drift_type values that the original migration's CHECK constraint
-- doesn't allow:
--
--   stuck_pending     — Tamara/Tabby payment in PENDING > 24h, gateway side
--                       already terminal (or also pending — abandoned)
--   stuck_approval    — bank-transfer payment in awaiting_approval > 7 days
--                       (finance forgot it; surface so reviewer notices)
--   orphan_receipt    — receipt was reviewer-approved but linked payment did
--                       NOT advance to PAID (data-integrity bug)
--   paid_no_receipt   — bank-transfer payment is PAID but no receipt row
--                       exists (manual override or write bypassed the flow)
--
-- We drop + recreate the CHECK constraint rather than ALTER because Postgres
-- has no in-place "add value to CHECK list" operation.

ALTER TABLE reconciliation_findings
  DROP CONSTRAINT IF EXISTS reconciliation_findings_drift_type_check;

ALTER TABLE reconciliation_findings
  ADD CONSTRAINT reconciliation_findings_drift_type_check
  CHECK (drift_type IN (
    'missing_local',
    'missing_gateway',
    'amount_mismatch',
    'status_mismatch',
    'stuck_pending',
    'stuck_approval',
    'orphan_receipt',
    'paid_no_receipt'
  ));
