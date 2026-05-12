-- Add per-course FAQ list. Only surfaced for zoom (online) courses on the
-- student course-detail page. Each item is a bilingual record:
--   { question?, questionAr?, answer?, answerAr? }
-- Stored as jsonb so we can query/index in future if needed. Nullable so
-- existing rows are unaffected.

ALTER TABLE "courses"
    ADD COLUMN IF NOT EXISTS "faqs" jsonb;
