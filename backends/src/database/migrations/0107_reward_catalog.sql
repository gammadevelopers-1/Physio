-- Rewards catalog + redemption ledger + per-user coupon lock.
-- The target_user_id column added to discount_codes lets us mint coupons that
-- only the redeeming student can use (the "point-redemption coupon" case) —
-- validateDiscount rejects the code for any other user. NULL preserves the
-- existing behaviour for regular admin-created coupons.

ALTER TABLE discount_codes
  ADD COLUMN IF NOT EXISTS target_user_id UUID
    REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS discount_codes_target_user_id_idx
  ON discount_codes(target_user_id);

-- Rewards catalog + redemption ledger.
-- The catalog holds admin-managed redeemable items; a redemption row is created
-- (with a debit ledger entry) every time a student successfully spends points.
-- Fulfillment is per-type: coupon rewards materialise a discount_codes row;
-- free-course/webinar rewards create the enrollment/registration; "other"
-- rewards stay in `pending` for admin manual fulfillment.

CREATE TABLE IF NOT EXISTS reward_catalog (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en              VARCHAR(200) NOT NULL,
  name_ar              VARCHAR(200),
  description_en       TEXT,
  description_ar       TEXT,
  icon                 VARCHAR(50),                  -- emoji or preset key
  type                 VARCHAR(30) NOT NULL,         -- discount_coupon | fixed_discount_coupon | free_course | free_webinar | other
  points_cost          INTEGER NOT NULL,
  payload              JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  display_order        INTEGER NOT NULL DEFAULT 0,
  max_per_user         INTEGER,                      -- null = unlimited
  total_stock          INTEGER,                      -- null = unlimited
  total_redeemed       INTEGER NOT NULL DEFAULT 0,   -- counter incremented atomically per fulfilled redemption
  valid_from           TIMESTAMP,
  valid_until          TIMESTAMP,
  created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT reward_catalog_type_check
    CHECK (type IN ('discount_coupon','fixed_discount_coupon','free_course','free_webinar','other')),
  CONSTRAINT reward_catalog_points_cost_positive CHECK (points_cost > 0),
  CONSTRAINT reward_catalog_stock_nonneg CHECK (total_stock IS NULL OR total_stock >= 0),
  CONSTRAINT reward_catalog_max_per_user_pos CHECK (max_per_user IS NULL OR max_per_user > 0),
  CONSTRAINT reward_catalog_totals_consistent CHECK (total_redeemed >= 0)
);

CREATE INDEX IF NOT EXISTS reward_catalog_active_idx        ON reward_catalog(is_active);
CREATE INDEX IF NOT EXISTS reward_catalog_display_order_idx ON reward_catalog(display_order);
CREATE INDEX IF NOT EXISTS reward_catalog_type_idx          ON reward_catalog(type);


CREATE TABLE IF NOT EXISTS reward_redemptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id            UUID NOT NULL REFERENCES reward_catalog(id) ON DELETE RESTRICT,
  points_spent         INTEGER NOT NULL,
  status               VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending | fulfilled | failed | reversed
  fulfillment_payload  JSONB NOT NULL DEFAULT '{}'::jsonb,       -- e.g. { discountCodeId, discountCode, enrollmentId, sessionId }
  ledger_tx_id         UUID REFERENCES point_transactions(id) ON DELETE SET NULL,
  failure_reason       TEXT,
  redeemed_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  fulfilled_at         TIMESTAMP,
  expires_at           TIMESTAMP,                    -- for coupon-type rewards; mirrors the underlying discount_codes.valid_until
  reversed_at          TIMESTAMP,
  reversed_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  reversal_reason      TEXT,
  CONSTRAINT reward_redemptions_status_check
    CHECK (status IN ('pending','fulfilled','failed','reversed')),
  CONSTRAINT reward_redemptions_points_positive CHECK (points_spent > 0)
);

CREATE INDEX IF NOT EXISTS reward_redemptions_user_id_idx    ON reward_redemptions(user_id);
CREATE INDEX IF NOT EXISTS reward_redemptions_reward_id_idx  ON reward_redemptions(reward_id);
CREATE INDEX IF NOT EXISTS reward_redemptions_status_idx     ON reward_redemptions(status);
CREATE INDEX IF NOT EXISTS reward_redemptions_redeemed_at_idx ON reward_redemptions(redeemed_at);
