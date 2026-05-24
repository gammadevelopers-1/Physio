-- Separate audit columns on certificate_requests. The legacy
-- `reviewed_by` / `review_note` / `reviewed_at` fields stay populated
-- (manager UI reads them), but they share one slot per row — so when a
-- previously-approved certificate is revoked, the original approver is
-- overwritten. The new columns preserve the full audit trail per
-- transition (approve, reject, revoke each have their own actor +
-- timestamp + reason where applicable).
--
-- Idempotent: all ADD COLUMN clauses use IF NOT EXISTS.

ALTER TABLE certificate_requests
  ADD COLUMN IF NOT EXISTS approved_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at         TIMESTAMP,
  ADD COLUMN IF NOT EXISTS rejected_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at         TIMESTAMP,
  ADD COLUMN IF NOT EXISTS rejection_reason    TEXT,
  ADD COLUMN IF NOT EXISTS revoked_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_at          TIMESTAMP,
  ADD COLUMN IF NOT EXISTS revocation_reason   TEXT;

-- Index on approver/rejector/revoker for admin queue dashboards
-- ("show me all certificates this admin has ever revoked").
CREATE INDEX IF NOT EXISTS certificate_requests_approved_by_idx ON certificate_requests(approved_by);
CREATE INDEX IF NOT EXISTS certificate_requests_rejected_by_idx ON certificate_requests(rejected_by);
CREATE INDEX IF NOT EXISTS certificate_requests_revoked_by_idx  ON certificate_requests(revoked_by);
