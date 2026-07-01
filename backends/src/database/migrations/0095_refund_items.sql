-- FIN-03: Per-line refunds (refund_items junction)
--
-- Multi-course payments produce one payment + N payment_items. Before this
-- migration a refund row could only describe "this payment, this amount" —
-- there was no way to record WHICH cart lines a refund covered, so a
-- partial cart refund had to drop every enrollment regardless of which
-- course the buyer actually wanted to keep.
--
-- This adds a junction so a refund can name a subset of payment_items.
-- All four gateways (Moyasar, Tabby, Tamara, Bank Transfer) accept a
-- smaller amount than the original payment:
--   * Moyasar:     POST /payments/{id}/refund    body: { amount }
--   * Tabby:       POST /payments/{id}/refunds   body: { amount, items?[] }
--   * Tamara:      POST /payments/simplified-refund/{id}
--                                                body: { total_amount, ... }
--   * Bank Transf: manual wire by finance — records the math, no API call
--
-- Compatibility:
--   * Existing refunds get backfilled below as covering ALL payment_items
--     of their payment (treated as full-payment refunds, matching the
--     behavior they actually had).
--   * Refunds whose payment has no payment_items rows (legacy single-course
--     payments created before payment_items existed, migration 0082) get
--     no refund_items rows — the cascade reader in RefundService falls
--     back to payments.course_id / payments.enrollment_id for those.

CREATE TABLE IF NOT EXISTS refund_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id       UUID NOT NULL REFERENCES refunds(id)       ON DELETE CASCADE,
  payment_item_id UUID NOT NULL REFERENCES payment_items(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES courses(id),
  enrollment_id   UUID REFERENCES enrollments(id)            ON DELETE SET NULL,

  -- Snapshot of the line math at refund time. line_total =
  -- line_amount + line_vat − line_discount, with VAT + discount
  -- apportioned proportionally from the payment-level totals.
  line_amount     NUMERIC(10,2) NOT NULL,             -- subtotal share before VAT/discount
  line_vat        NUMERIC(10,2) NOT NULL DEFAULT 0,   -- apportioned VAT share
  line_discount   NUMERIC(10,2) NOT NULL DEFAULT 0,   -- apportioned coupon share
  line_total      NUMERIC(10,2) NOT NULL,             -- what actually got refunded for this line

  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT refund_items_line_amount_check  CHECK (line_amount   >= 0),
  CONSTRAINT refund_items_line_vat_check     CHECK (line_vat      >= 0),
  CONSTRAINT refund_items_line_disc_check    CHECK (line_discount >= 0),
  CONSTRAINT refund_items_line_total_check   CHECK (line_total    >= 0)
);

CREATE INDEX IF NOT EXISTS idx_refund_items_refund       ON refund_items(refund_id);
CREATE INDEX IF NOT EXISTS idx_refund_items_payment_item ON refund_items(payment_item_id);
CREATE INDEX IF NOT EXISTS idx_refund_items_course       ON refund_items(course_id);
CREATE INDEX IF NOT EXISTS idx_refund_items_enrollment   ON refund_items(enrollment_id);

-- One refund cannot cover the same payment_item twice — would be a
-- double-count in the math. Application layer also blocks a second refund
-- from covering a payment_item that was already refunded by an earlier
-- COMPLETED refund (a payment_item is either refunded or not, no halves).
CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_items_unique_per_refund
  ON refund_items(refund_id, payment_item_id);

-- ─── Backfill ──────────────────────────────────────────────────────
-- Every existing refund covers every payment_item in its payment row.
-- Money snapshot uses payment_items.line_total directly (= sale_price -
-- discount_amount), with VAT split 0 because line-level VAT wasn't
-- tracked pre-migration. Apportioning gets exact on new refunds only.
INSERT INTO refund_items (
  refund_id, payment_item_id, course_id, enrollment_id,
  line_amount, line_vat, line_discount, line_total
)
SELECT
  r.id,
  pi.id,
  pi.course_id,
  pi.enrollment_id,
  pi.line_total,
  0,
  pi.discount_amount,
  pi.line_total
FROM refunds r
JOIN payment_items pi ON pi.payment_id = r.payment_id
WHERE NOT EXISTS (
  SELECT 1 FROM refund_items ri
   WHERE ri.refund_id = r.id AND ri.payment_item_id = pi.id
);
