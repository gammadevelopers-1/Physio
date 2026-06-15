-- FIN-01: Finance Module Schema — bring the payments table from main's
-- placeholder shape (provider/completed) to the gateway integration shape,
-- and create the new invoices / refunds / discount_codes / discount_usage
-- tables. Includes data migration for any existing prod payment rows
-- written by the legacy `processCheckoutPlaceholder` service.

-- ─── payments table: transform from placeholder shape to gateway shape ─────

-- 1a. Add the new columns first (nullable so existing rows pass).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway VARCHAR(20);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_charge_id VARCHAR(255);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_response JSONB;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS error_code VARCHAR(50);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- 1b. Backfill gateway from provider for any existing rows.
-- Legacy values: 'placeholder' / 'stripe' / 'hyperpay' → all become 'mock'
-- so they pass the new check constraint. They were never real payments.
UPDATE payments SET gateway = 'mock'
  WHERE gateway IS NULL;

-- 1c. Backfill gateway_charge_id from provider_ref.
UPDATE payments SET gateway_charge_id = provider_ref
  WHERE gateway_charge_id IS NULL AND provider_ref IS NOT NULL;

-- 1d. Remap status values: 'completed' (legacy) → 'paid' (new vocabulary).
UPDATE payments SET status = 'paid' WHERE status = 'completed';

-- 1e. Backfill paid_at for migrated 'paid' rows so finance reports work.
UPDATE payments SET paid_at = updated_at
  WHERE status = 'paid' AND paid_at IS NULL;

-- 1f. Now make gateway NOT NULL (all rows are backfilled).
ALTER TABLE payments ALTER COLUMN gateway SET NOT NULL;

-- 1g. Drop the legacy provider columns.
ALTER TABLE payments DROP COLUMN IF EXISTS provider;
ALTER TABLE payments DROP COLUMN IF EXISTS provider_ref;

-- 1h. Change status default from 'completed' to 'pending' (new flow starts pending).
ALTER TABLE payments ALTER COLUMN status SET DEFAULT 'pending';

-- 1i. Replace status check constraint with the expanded enum.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'partially_refunded', 'chargeback'));

-- 1j. Add gateway check constraint.
ALTER TABLE payments ADD CONSTRAINT payments_gateway_check
  CHECK (gateway IN ('tap', 'moyasar', 'tamara', 'tabby', 'mock'));

-- 1k. Add payment_method check constraint.
ALTER TABLE payments ADD CONSTRAINT payments_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('card', 'mada', 'apple_pay', 'bnpl'));

-- 1l. New indices used by finance queries and webhook dedup.
CREATE INDEX IF NOT EXISTS payments_gateway_idx ON payments (gateway);
CREATE INDEX IF NOT EXISTS payments_gateway_charge_id_idx ON payments (gateway_charge_id);

-- Drop legacy indices that referenced dropped columns (if they existed).
DROP INDEX IF EXISTS payments_enrollment_id_idx;

-- ─── invoices table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  VARCHAR(20) NOT NULL,
  payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  subtotal        NUMERIC(10, 2) NOT NULL,
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(10, 2) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'issued',
  issued_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  paid_at         TIMESTAMP,
  due_date        TIMESTAMP,
  pdf_url         TEXT,
  metadata        JSONB,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT invoices_status_check
    CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'cancelled', 'refunded'))
);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_number_unique ON invoices (invoice_number);
CREATE INDEX IF NOT EXISTS invoices_user_id_idx     ON invoices (user_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx      ON invoices (status);
CREATE INDEX IF NOT EXISTS invoices_payment_id_idx  ON invoices (payment_id);

-- ─── refunds table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS refunds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id        UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id        UUID REFERENCES invoices(id) ON DELETE SET NULL,
  requested_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  processed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  reason            VARCHAR(30) NOT NULL,
  reason_note       TEXT,
  original_amount   NUMERIC(10, 2) NOT NULL,
  deduction_amount  NUMERIC(10, 2) NOT NULL DEFAULT 0,
  deduction_reason  TEXT,
  refund_amount     NUMERIC(10, 2) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  gateway_refund_id VARCHAR(255),
  approved_at       TIMESTAMP,
  completed_at      TIMESTAMP,
  rejected_at       TIMESTAMP,
  rejection_note    TEXT,
  approval_note     TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT refunds_reason_check
    CHECK (reason IN ('policy', 'cancelled', 'technical', 'duplicate', 'other')),
  CONSTRAINT refunds_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS refunds_payment_id_idx   ON refunds (payment_id);
CREATE INDEX IF NOT EXISTS refunds_status_idx       ON refunds (status);
CREATE INDEX IF NOT EXISTS refunds_requested_by_idx ON refunds (requested_by);

-- ─── discount_codes table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discount_codes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                VARCHAR(50) NOT NULL,
  type                VARCHAR(20) NOT NULL,
  value               NUMERIC(10, 2) NOT NULL,
  max_uses            INTEGER,
  current_uses        INTEGER NOT NULL DEFAULT 0,
  min_order_amount    NUMERIC(10, 2),
  applicable_courses  UUID[] NOT NULL DEFAULT '{}'::UUID[],
  valid_from          TIMESTAMP,
  valid_until         TIMESTAMP,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_by          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT discount_codes_type_check CHECK (type IN ('percentage', 'fixed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_code_unique     ON discount_codes (code);
CREATE INDEX        IF NOT EXISTS discount_codes_is_active_idx   ON discount_codes (is_active);
CREATE INDEX        IF NOT EXISTS discount_codes_applicable_courses_gin
  ON discount_codes USING GIN (applicable_courses);

-- ─── discount_usage table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discount_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id   UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_id    UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  amount_saved  NUMERIC(10, 2) NOT NULL,
  used_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS discount_usage_unique
  ON discount_usage (discount_id, user_id, payment_id);
CREATE INDEX        IF NOT EXISTS discount_usage_discount_id_idx ON discount_usage (discount_id);
CREATE INDEX        IF NOT EXISTS discount_usage_user_id_idx     ON discount_usage (user_id);
