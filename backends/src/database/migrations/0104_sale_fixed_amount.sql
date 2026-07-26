-- Course-level sales can now be either a percentage OR a fixed SAR amount.
-- Adds `sale_amount` alongside the existing `sale_percent`; a CHECK
-- constraint enforces that only ONE is set at a time (per-course sale is
-- one kind of discount, not both). `sale_amount` must be positive when set.
--
-- Nothing to backfill — existing rows are percentage-only or null.

ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "sale_amount" numeric(10, 2);

ALTER TABLE "courses"
  DROP CONSTRAINT IF EXISTS "courses_sale_amount_positive";
ALTER TABLE "courses"
  ADD CONSTRAINT "courses_sale_amount_positive"
  CHECK ("sale_amount" IS NULL OR "sale_amount" > 0);

ALTER TABLE "courses"
  DROP CONSTRAINT IF EXISTS "courses_sale_only_one_kind";
ALTER TABLE "courses"
  ADD CONSTRAINT "courses_sale_only_one_kind"
  CHECK ("sale_amount" IS NULL OR "sale_percent" IS NULL);
