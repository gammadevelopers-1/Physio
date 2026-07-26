-- Campaigns are shown publicly (site banner, course card sale label). Add
-- Arabic variants for the name + description so the display picks the
-- right language based on the visitor's locale. English stays in the
-- existing `name`/`description` columns; Arabic is optional — when null
-- the display falls back to the English text.

ALTER TABLE "coupon_campaigns"
  ADD COLUMN IF NOT EXISTS "name_ar" varchar(100);

ALTER TABLE "coupon_campaigns"
  ADD COLUMN IF NOT EXISTS "description_ar" text;
