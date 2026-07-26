-- The public banner button label was single-locale. Add an Arabic
-- variant so the button reads correctly to visitors on the Arabic site.
-- When null, the display falls back to the English `banner_cta`, which
-- itself falls back to a translated default in the frontend.

ALTER TABLE "coupon_campaigns"
  ADD COLUMN IF NOT EXISTS "banner_cta_ar" varchar(80);
