-- ===========================================
-- Reconciliation Findings
-- ===========================================
-- Append-only log of drift between our payments table and the gateways'
-- own records, produced by the daily reconciliation scan. Finance reviews
-- and resolves each finding manually (resync, mark resolved, or ignore).
--
-- Drift types we track:
--   missing_local        — paid on gateway, no payment row on our side
--   missing_gateway      — paid in our DB, no corresponding row on gateway
--   amount_mismatch      — amount differs between our DB and gateway
--   status_mismatch      — status differs (e.g. we say paid, gateway refunded)
--
-- Status flow: unresolved → (resolved | ignored). resolved means finance
-- took action (resync, manual fix). ignored means finance reviewed and
-- decided it's not actionable (e.g. test data, known abandoned attempt).

CREATE TABLE IF NOT EXISTS reconciliation_findings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id       uuid NOT NULL,
  gateway           varchar(20) NOT NULL,
  drift_type        varchar(32) NOT NULL,
  payment_id        uuid REFERENCES payments(id) ON DELETE SET NULL,
  gateway_charge_id varchar(255),
  our_value         jsonb,
  gateway_value     jsonb,
  status            varchar(16) NOT NULL DEFAULT 'unresolved',
  resolution_note   text,
  resolved_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at       timestamp,
  created_at        timestamp NOT NULL DEFAULT now(),
  updated_at        timestamp NOT NULL DEFAULT now(),
  CONSTRAINT reconciliation_findings_gateway_check
    CHECK (gateway IN ('moyasar', 'tamara', 'tabby', 'bank_transfer', 'mock')),
  CONSTRAINT reconciliation_findings_drift_type_check
    CHECK (drift_type IN ('missing_local', 'missing_gateway', 'amount_mismatch', 'status_mismatch')),
  CONSTRAINT reconciliation_findings_status_check
    CHECK (status IN ('unresolved', 'resolved', 'ignored'))
);

CREATE INDEX IF NOT EXISTS reconciliation_findings_status_idx
  ON reconciliation_findings(status);
CREATE INDEX IF NOT EXISTS reconciliation_findings_gateway_idx
  ON reconciliation_findings(gateway);
CREATE INDEX IF NOT EXISTS reconciliation_findings_payment_id_idx
  ON reconciliation_findings(payment_id);
CREATE INDEX IF NOT EXISTS reconciliation_findings_scan_run_id_idx
  ON reconciliation_findings(scan_run_id);
CREATE INDEX IF NOT EXISTS reconciliation_findings_created_at_idx
  ON reconciliation_findings(created_at DESC);

-- Dedup index: prevent re-recording the same drift on every scan. A finding
-- is "the same" if it's the same (gateway, drift_type, charge id) AND still
-- unresolved. We use a partial unique index so resolved/ignored history
-- doesn't block fresh re-detection if the drift comes back.
CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_findings_dedup_idx
  ON reconciliation_findings(gateway, drift_type, gateway_charge_id)
  WHERE status = 'unresolved' AND gateway_charge_id IS NOT NULL;

-- For missing_gateway findings where there's no gateway_charge_id, dedup on
-- the local payment_id instead.
CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_findings_dedup_local_idx
  ON reconciliation_findings(gateway, drift_type, payment_id)
  WHERE status = 'unresolved' AND payment_id IS NOT NULL;

-- Scan runs — header table so finance can see "scan started, scanned N
-- gateway records, found M drifts, ran for X seconds, finished at T".
CREATE TABLE IF NOT EXISTS reconciliation_scans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway         varchar(20) NOT NULL,
  from_date       timestamp NOT NULL,
  to_date         timestamp NOT NULL,
  status          varchar(16) NOT NULL DEFAULT 'running',
  records_scanned integer NOT NULL DEFAULT 0,
  drifts_found    integer NOT NULL DEFAULT 0,
  triggered_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at      timestamp NOT NULL DEFAULT now(),
  finished_at     timestamp,
  duration_ms     integer,
  error_message   text,
  CONSTRAINT reconciliation_scans_gateway_check
    CHECK (gateway IN ('moyasar', 'tamara', 'tabby', 'bank_transfer', 'mock', 'all')),
  CONSTRAINT reconciliation_scans_status_check
    CHECK (status IN ('running', 'succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS reconciliation_scans_started_idx
  ON reconciliation_scans(started_at DESC);
CREATE INDEX IF NOT EXISTS reconciliation_scans_gateway_idx
  ON reconciliation_scans(gateway);
