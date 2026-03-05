-- FIN-01: Finance Module Schema Alignment
-- Aligns payments, invoices, refunds, and discount_codes with the spec.
-- Data migrations run BEFORE constraint updates to avoid violations.

-- ─── payments ───────────────────────────────────────────────────────────────
-- Add machine-readable gateway error code column
ALTER TABLE payments ADD COLUMN IF NOT EXISTS error_code VARCHAR(50);

-- Expand status enum to include chargeback
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'partially_refunded', 'chargeback'));

-- ─── invoices ───────────────────────────────────────────────────────────────
-- Expand status enum to include draft (for manually created invoices)
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'cancelled', 'refunded'));

-- ─── refunds ────────────────────────────────────────────────────────────────
-- Add human-readable deduction reason (e.g. "Tamara BNPL 10% processing fee")
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS deduction_reason TEXT;

-- Drop old reason check constraint FIRST so data migration can run without violation
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_reason_check;

-- Data migration: rename reason values to match spec
UPDATE refunds SET reason = 'cancelled' WHERE reason = 'course_issue';
UPDATE refunds SET reason = 'policy'    WHERE reason = 'personal';

-- Re-add reason check constraint with spec values
ALTER TABLE refunds ADD CONSTRAINT refunds_reason_check
  CHECK (reason IN ('policy', 'cancelled', 'technical', 'duplicate', 'other'));

-- ─── discount_codes ─────────────────────────────────────────────────────────
-- Add applicable_courses array (empty array = global discount, applies to all courses)
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS applicable_courses UUID[] NOT NULL DEFAULT '{}';

-- Migrate existing single course_id into the new array column (preserves data)
UPDATE discount_codes
  SET applicable_courses = ARRAY[course_id]::UUID[]
  WHERE course_id IS NOT NULL;

-- Drop the old foreign key constraint and course_id column
ALTER TABLE discount_codes DROP CONSTRAINT IF EXISTS discount_codes_course_id_courses_id_fk;
ALTER TABLE discount_codes DROP COLUMN IF EXISTS course_id;

-- Drop the old index on course_id (no longer exists)
DROP INDEX IF EXISTS discount_codes_course_id_idx;

-- Add GIN index for efficient array queries (= ANY(), @> contains operator)
CREATE INDEX IF NOT EXISTS discount_codes_applicable_courses_gin
  ON discount_codes USING GIN (applicable_courses);
