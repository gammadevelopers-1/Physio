-- Coupon system extensions:
--   1. New `coupon_campaigns` parent entity grouping discount codes.
--      Lets finance set a campaign budget; child codes auto-deactivate when
--      the campaign's `ends_at` passes or `current_spend >= budget`.
--      `show_on_site=true` surfaces a public banner on courses pages.
--   2. `discount_codes.campaign_id` FK + `auto_apply` flag.
--      `auto_apply` = early-bird codes that the system applies automatically
--      to any eligible cart (no code typing required).
--   3. `courses.max_discount_pct` safety cap so a 100%-fixed coupon can't
--      zero out a premium course by accident. Default 100 = no cap.
--
-- All additions are backwards-compatible (new columns are nullable or
-- have safe defaults). No data backfill needed.

-- ─── 1. coupon_campaigns ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupon_campaigns (
  id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  name            varchar(100)   NOT NULL,
  description     text,
  starts_at       timestamp,
  ends_at         timestamp,
  budget          numeric(12, 2),
  current_spend   numeric(12, 2) NOT NULL DEFAULT 0,
  is_active       boolean        NOT NULL DEFAULT true,
  show_on_site    boolean        NOT NULL DEFAULT false,
  banner_cta      varchar(80),
  created_by      uuid           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      timestamp      NOT NULL DEFAULT now(),
  updated_at      timestamp      NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coupon_campaigns_is_active_idx     ON coupon_campaigns (is_active);
CREATE INDEX IF NOT EXISTS coupon_campaigns_show_on_site_idx  ON coupon_campaigns (show_on_site);
CREATE INDEX IF NOT EXISTS coupon_campaigns_ends_at_idx       ON coupon_campaigns (ends_at);

-- ─── 2. discount_codes extensions ───────────────────────────────────
ALTER TABLE discount_codes
  ADD COLUMN IF NOT EXISTS campaign_id uuid,
  ADD COLUMN IF NOT EXISTS auto_apply  boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS discount_codes_campaign_id_idx ON discount_codes (campaign_id);
CREATE INDEX IF NOT EXISTS discount_codes_auto_apply_idx  ON discount_codes (auto_apply) WHERE auto_apply = true;

-- ─── 3. courses.max_discount_pct ────────────────────────────────────
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS max_discount_pct numeric(5, 2) NOT NULL DEFAULT 100;
