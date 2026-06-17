-- Coupon enhancements (Section 10):
--   * max_uses_per_user — configurable per-user redemption cap (NULL = unlimited).
--     Default 1 preserves the previous hardcoded "one use per user" behaviour.
--   * campaign — optional grouping label for promotional campaigns.
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS max_uses_per_user INTEGER DEFAULT 1;
ALTER TABLE discount_codes ADD COLUMN IF NOT EXISTS campaign VARCHAR(100);
CREATE INDEX IF NOT EXISTS discount_codes_campaign_idx ON discount_codes (campaign);
