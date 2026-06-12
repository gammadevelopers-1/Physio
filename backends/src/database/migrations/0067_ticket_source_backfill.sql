-- Backfill: every ticket created before Phase 1 (multi-role Support) came
-- from the student inbox. Tag them so the student dashboard's Support tab
-- continues to show them after we start filtering by source.
-- Intervention-created tickets already have source='intervention' from
-- the prior migration, so they are excluded here.
UPDATE tickets
SET source = 'student'
WHERE source IS NULL;
