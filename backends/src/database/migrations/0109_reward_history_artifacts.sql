-- Fulfillment artifact for reward redemptions.
-- Phase 1 (history page) reads this; Phase 2 (Other-reward workflow) writes it.
-- jsonb so it can hold {kind, value, meta} shapes for text codes, external links,
-- tracking numbers, etc.
ALTER TABLE reward_redemptions
  ADD COLUMN IF NOT EXISTS fulfillment_artifact jsonb;
