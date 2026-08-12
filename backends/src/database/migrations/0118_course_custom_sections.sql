-- Per-course custom sections authored by the manager. Each entry:
--   { id, titleEn, titleAr?, contentEn?, contentAr? }
-- The section slots into the public page via the key `custom:<id>` inside
-- `sections_order`, so it reorders alongside the fixed sections without any
-- special-case rendering paths. Nullable and additive — existing courses
-- continue to render the fixed sections only.

ALTER TABLE "courses" ADD COLUMN "custom_sections" jsonb;
