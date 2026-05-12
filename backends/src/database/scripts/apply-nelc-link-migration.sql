-- ===================================================================
-- Add optional nelc_review_link column to courses — idempotent
-- ===================================================================

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS nelc_review_link VARCHAR(500);
