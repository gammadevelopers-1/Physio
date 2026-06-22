-- Add 'abandoned' payment status for rows where the buyer clicked Pay but
-- never completed the gateway checkout flow. A cron sweep marks
-- pending/processing rows with no gateway_charge_id older than 24h as
-- 'abandoned'. Default Payments page view excludes them so finance only
-- sees actionable rows. Reconciliation can still see them when chasing drift.

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN (
    'pending',
    'processing',
    'awaiting_approval',
    'paid',
    'failed',
    'refunded',
    'partially_refunded',
    'chargeback',
    'rejected',
    'abandoned'
  ));

-- Partial index optimised for the cron sweep — scans only stale candidates,
-- not the full payments table.
CREATE INDEX IF NOT EXISTS payments_abandoned_sweep_idx
  ON payments (created_at)
  WHERE status IN ('pending', 'processing') AND gateway_charge_id IS NULL;
