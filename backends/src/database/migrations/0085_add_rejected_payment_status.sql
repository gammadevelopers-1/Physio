-- ===========================================
-- Add 'rejected' status to payments
-- ===========================================
-- Rejected is semantically distinct from failed:
--   failed   = platform/gateway failure (Moyasar declined, network error, etc.)
--   rejected = finance reviewer rejected a bank-transfer receipt
--
-- Previously the bank-transfer reject flow set status='failed' which conflated
-- the two and made it impossible to report on real platform failures separately
-- from rejected bank transfers.

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN (
    'pending',
    'processing',
    'awaiting_approval',
    'paid',
    'failed',
    'rejected',
    'refunded',
    'partially_refunded',
    'chargeback'
  ));

-- Backfill: rows that were marked FAILED by the (very short-lived) version of
-- rejectReceipt that set FAILED instead of REJECTED. The failureReason prefix
-- "Bank transfer receipt rejected:" uniquely identifies those rows.
UPDATE payments
SET status = 'rejected'
WHERE status = 'failed'
  AND gateway = 'bank_transfer'
  AND failure_reason LIKE 'Bank transfer receipt rejected:%';
