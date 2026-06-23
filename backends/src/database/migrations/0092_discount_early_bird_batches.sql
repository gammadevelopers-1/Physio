-- Discount system enhancements:
--   1. `discount_codes.early_bird` — explicit early-bird marker. Distinct from
--      `auto_apply` so finance can run an early-bird campaign that's NOT
--      auto-applied (e.g. requires a code to claim) and vice-versa.
--      Surfaces in the public "Early Bird" badge and the dedicated tab in
--      the finance dashboard.
--
--   2. `discount_code_batches` — every bulk generation gets a batch record.
--      Lets finance audit which prefix was generated when, how many codes,
--      and what percentage have been redeemed. Codes link back via
--      `discount_codes.batch_id`.
--
-- All additions are backwards-compatible (new columns nullable / default).

-- ─── 1. early_bird flag ─────────────────────────────────────────────
ALTER TABLE discount_codes
  ADD COLUMN IF NOT EXISTS early_bird boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS discount_codes_early_bird_idx
  ON discount_codes (early_bird) WHERE early_bird = true;

-- ─── 2. discount_code_batches ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS discount_code_batches (
  id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix           varchar(50)    NOT NULL,
  requested_count  integer        NOT NULL,
  created_count    integer        NOT NULL,
  type             varchar(20)    NOT NULL,
  value            numeric(10, 2) NOT NULL,
  max_uses         integer,
  max_uses_per_user integer,
  campaign_id      uuid,
  campaign_label   varchar(100),
  min_order_amount numeric(10, 2),
  applicable_courses uuid[] NOT NULL DEFAULT '{}'::uuid[],
  valid_from       timestamp,
  valid_until      timestamp,
  early_bird       boolean        NOT NULL DEFAULT false,
  auto_apply       boolean        NOT NULL DEFAULT false,
  created_by       uuid           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       timestamp      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discount_code_batches_created_at_idx
  ON discount_code_batches (created_at DESC);

CREATE INDEX IF NOT EXISTS discount_code_batches_campaign_id_idx
  ON discount_code_batches (campaign_id);

-- ─── 3. discount_codes.batch_id ─────────────────────────────────────
ALTER TABLE discount_codes
  ADD COLUMN IF NOT EXISTS batch_id uuid;

CREATE INDEX IF NOT EXISTS discount_codes_batch_id_idx
  ON discount_codes (batch_id);
