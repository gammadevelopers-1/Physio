-- ===================================================================
-- Add per-course SEO override columns — idempotent
-- ===================================================================
-- Empty/null values fall back to existing course title / description /
-- thumbnail in the metadata helper. Manager UI exposes these as a
-- collapsible "SEO" section on the course edit form.
-- ===================================================================

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS seo_title       VARCHAR(150),
  ADD COLUMN IF NOT EXISTS seo_description VARCHAR(300),
  ADD COLUMN IF NOT EXISTS seo_keywords    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS seo_og_image    VARCHAR(500),
  ADD COLUMN IF NOT EXISTS seo_noindex     BOOLEAN DEFAULT FALSE;
