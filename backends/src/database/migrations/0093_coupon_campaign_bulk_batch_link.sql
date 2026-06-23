-- Coupon-campaign extension: link a campaign back to a bulk-generation
-- batch when finance generates a batch from the Bulk-Generate wizard.
--
-- Each bulk batch now auto-creates a campaign (named after the prefix)
-- and all generated codes are attached to it. The dashboard surfaces a
-- "Bulk batch" badge on these campaigns so finance can distinguish them
-- from manually-created promotional campaigns.

ALTER TABLE coupon_campaigns
  ADD COLUMN IF NOT EXISTS bulk_batch_id uuid;

CREATE INDEX IF NOT EXISTS coupon_campaigns_bulk_batch_id_idx
  ON coupon_campaigns (bulk_batch_id);
