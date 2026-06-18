-- FIN-02b: Multi-course payment (one payment, many line items).
--
-- Splits a payment into N line items so a student can buy multiple courses
-- in a single gateway redirect and a single invoice. Each line item links
-- to a course and, after a successful payment, to the enrollment created
-- for that course.
--
-- Compatibility:
--   * Legacy single-course payments keep working unchanged. `payments.course_id`
--     stays NOT NULL — for new multi-line payments it stores the FIRST course
--     in the order so existing finance/list queries that join on course_id
--     still render a row.
--   * `payments.enrollment_id` was already nullable; new multi-line payments
--     leave it NULL and rely on `payment_items.enrollment_id` (one per line).
--   * Old payments simply have no rows in payment_items; readers that fall
--     back to `payments.course_id` see one item, which is correct.

-- ─── 1. payment_items table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES courses(id),
  enrollment_id   UUID REFERENCES enrollments(id) ON DELETE SET NULL,

  -- Snapshot of pricing at the time of purchase. Course price can change
  -- after the fact; the invoice must remain immutable.
  unit_price      NUMERIC(10,2) NOT NULL,            -- list price (course.price)
  sale_price      NUMERIC(10,2) NOT NULL,            -- after course-level sale
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,  -- coupon allocated to this line
  line_total      NUMERIC(10,2) NOT NULL,            -- sale_price - discount_amount

  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT payment_items_unit_price_check    CHECK (unit_price >= 0),
  CONSTRAINT payment_items_sale_price_check    CHECK (sale_price >= 0),
  CONSTRAINT payment_items_discount_check      CHECK (discount_amount >= 0),
  CONSTRAINT payment_items_line_total_check    CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payment_items_payment    ON payment_items(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_items_course     ON payment_items(course_id);
CREATE INDEX IF NOT EXISTS idx_payment_items_enrollment ON payment_items(enrollment_id);

-- One payment cannot contain the same course twice (no quantity field —
-- a student either owns a course or doesn't).
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_items_unique_per_payment
  ON payment_items(payment_id, course_id);
