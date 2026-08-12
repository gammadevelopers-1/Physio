-- Adds optional Arabic titles for course materials and assessments.
-- The frontend picks title_ar when locale is 'ar' AND the value is set;
-- otherwise it falls back to `title`. Nullable so existing rows stay valid
-- and English-only authoring keeps working.

ALTER TABLE "course_materials" ADD COLUMN "title_ar" varchar(255);
ALTER TABLE "assessments" ADD COLUMN "title_ar" varchar(255);
