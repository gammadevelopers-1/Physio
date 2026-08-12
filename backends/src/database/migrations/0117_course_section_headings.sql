-- Per-course section-heading overrides for the public course-detail page.
-- Shape: { overview?: { en?, ar? }, objectives?: { en?, ar? }, ... }
-- Any missing key/locale falls back to the Strapi course-detail-page default.
-- Nullable and additive so existing rows continue to show Strapi defaults.

ALTER TABLE "courses" ADD COLUMN "section_headings" jsonb;
