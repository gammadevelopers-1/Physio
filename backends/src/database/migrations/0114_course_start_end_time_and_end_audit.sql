-- Course scheduling gains a time-of-day, plus manual End-Course audit.
--
-- 1) start_date / end_date convert from `date` to `timestamp`. All existing
--    date-only values are treated as midnight Asia/Riyadh (AST = UTC+3, no
--    DST) so a course previously stored as "2026-05-10" reads back as
--    2026-05-10 00:00 Riyadh (== 2026-05-09 21:00 UTC in the naive column).
--    Same UTC-stored / Riyadh-rendered convention as enrollment_deadline.
--
-- 2) original_start_date follows: it's a snapshot of the pre-reschedule
--    start, so it must match the new type.
--
-- 3) New end audit columns capture who manually ended a course + why
--    (reason is optional per Amna 2026-08). Distinct from `cancelled_*`
--    because cancellation drops enrolments + queues refunds; End Course
--    is a benign "we're done teaching, awaiting Mark Completed" flip
--    that leaves enrolments untouched — same downstream shape as the
--    cron path, just human-initiated.

ALTER TABLE courses
  ALTER COLUMN start_date TYPE timestamp
    USING (start_date::timestamp AT TIME ZONE 'Asia/Riyadh' AT TIME ZONE 'UTC');

ALTER TABLE courses
  ALTER COLUMN end_date TYPE timestamp
    USING (end_date::timestamp AT TIME ZONE 'Asia/Riyadh' AT TIME ZONE 'UTC');

ALTER TABLE courses
  ALTER COLUMN original_start_date TYPE timestamp
    USING (original_start_date::timestamp AT TIME ZONE 'Asia/Riyadh' AT TIME ZONE 'UTC');

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS ended_at timestamp,
  ADD COLUMN IF NOT EXISTS ended_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS end_reason text;
