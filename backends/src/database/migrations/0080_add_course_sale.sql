-- Course-level sale (no coupon required). `price` stays the canonical original
-- price; the sale price is derived from sale_percent. 100 = free.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS sale_percent INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS sale_starts_at TIMESTAMP;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS sale_ends_at TIMESTAMP;
-- Per-course finance-manager toggle: allow a coupon to stack on top of the sale.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS sale_allows_coupon BOOLEAN NOT NULL DEFAULT false;

-- Constraints (drop-then-add so the migration is idempotent).
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_sale_percent_range;
ALTER TABLE courses ADD CONSTRAINT courses_sale_percent_range
  CHECK (sale_percent IS NULL OR (sale_percent >= 1 AND sale_percent <= 100));

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_sale_window_order;
ALTER TABLE courses ADD CONSTRAINT courses_sale_window_order
  CHECK (sale_starts_at IS NULL OR sale_ends_at IS NULL OR sale_ends_at > sale_starts_at);
