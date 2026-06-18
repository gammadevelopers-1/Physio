-- FIN-02: Bank Transfer payment method.
--
-- Adds 'bank_transfer' as a payment gateway and 'awaiting_approval' as a
-- payment status. Bank transfers are out-of-band: the student deposits to
-- our bank account externally, uploads a receipt, finance reviews and
-- approves manually. Refunds are also manual (no gateway API to call).
--
-- Also removes the unused 'tap' gateway value — Tap integration is not in
-- the milestone-10 scope, prod has zero Tap payment rows, and the gateway
-- code is being deleted. Any stray 'tap' rows are remapped to 'mock' as a
-- safety net.

-- ─── 1. Update payment status enum (add awaiting_approval) ────────────────

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
    'chargeback'
  ));

-- ─── 2. Update gateway enum (add bank_transfer, remove tap) ───────────────

-- Safety remap: any legacy 'tap' rows become 'mock' so the new constraint
-- accepts them. (Verified zero rows in prod before writing this migration.)
UPDATE payments SET gateway = 'mock' WHERE gateway = 'tap';

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_gateway_check;
ALTER TABLE payments ADD CONSTRAINT payments_gateway_check
  CHECK (gateway IN ('moyasar', 'tamara', 'tabby', 'bank_transfer', 'mock'));

-- ─── 3. payment_receipts: uploaded bank transfer proofs ───────────────────
--
-- One payment can have multiple receipts (re-uploads after rejection). The
-- 'active' receipt for a payment is the one whose replaced_by_id IS NULL.

CREATE TABLE IF NOT EXISTS payment_receipts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id             UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  uploaded_by            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- File (stored in private GCS bucket)
  file_name              VARCHAR(255) NOT NULL,
  mime_type              VARCHAR(100) NOT NULL,
  file_size_bytes        INTEGER NOT NULL,
  gcs_object_path        TEXT NOT NULL,

  -- Malware scan (async, populated by MalwareScanService)
  scan_status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  scan_engine            VARCHAR(50),
  scan_completed_at      TIMESTAMP,
  scan_meta              JSONB,

  -- Finance review
  review_status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at            TIMESTAMP,
  reviewer_note          TEXT,             -- shown to student on rejection
  finance_internal_note  TEXT,             -- private to finance team

  -- Student refund info (KSA-specific, captured at upload time so finance
  -- can wire a manual refund back if needed). National ID/Iqama is optional
  -- but recommended for verification.
  refund_account_holder  VARCHAR(255) NOT NULL,
  refund_iban            VARCHAR(34)  NOT NULL,
  refund_bank_name       VARCHAR(255) NOT NULL,
  refund_national_id     VARCHAR(20),

  -- Re-upload chain: old receipt's replaced_by_id points to the new one
  replaced_by_id         UUID REFERENCES payment_receipts(id) ON DELETE SET NULL,

  created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT payment_receipts_scan_status_check
    CHECK (scan_status IN ('pending', 'clean', 'infected', 'error')),
  CONSTRAINT payment_receipts_review_status_check
    CHECK (review_status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS payment_receipts_payment_id_idx
  ON payment_receipts (payment_id);
CREATE INDEX IF NOT EXISTS payment_receipts_review_status_idx
  ON payment_receipts (review_status);
CREATE INDEX IF NOT EXISTS payment_receipts_scan_status_idx
  ON payment_receipts (scan_status);
CREATE INDEX IF NOT EXISTS payment_receipts_uploaded_by_idx
  ON payment_receipts (uploaded_by);

-- ─── 4. Extend system_settings.payments.bankTransfer ──────────────────────
--
-- Existing fields: bankName, accountHolder, iban, instructionsEn, instructionsAr.
-- We add Arabic equivalents + a separate account number + swift code, and
-- migrate the existing single accountHolder to beneficiaryEn (preserving data).

UPDATE system_settings
SET value = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          value,
          '{bankTransfer,bankNameEn}',
          COALESCE(value->'bankTransfer'->'bankName', '""'::jsonb)
        ),
        '{bankTransfer,bankNameAr}', '""'::jsonb
      ),
      '{bankTransfer,beneficiaryEn}',
      COALESCE(value->'bankTransfer'->'accountHolder', '""'::jsonb)
    ),
    '{bankTransfer,beneficiaryAr}', '""'::jsonb
  ),
  '{bankTransfer,accountNumber}', '""'::jsonb
)
WHERE category = 'payments'
  AND value->'bankTransfer' IS NOT NULL;

UPDATE system_settings
SET value = jsonb_set(value, '{bankTransfer,swiftCode}', '""'::jsonb)
WHERE category = 'payments'
  AND value->'bankTransfer' IS NOT NULL
  AND NOT (value->'bankTransfer' ? 'swiftCode');
