-- FIN-11: Add approval note column for refund approvals
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS approval_note TEXT;
