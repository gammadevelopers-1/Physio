-- ===================================================================
-- Add optional accreditation_number column to courses — idempotent
-- ===================================================================

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS accreditation_number VARCHAR(100);
