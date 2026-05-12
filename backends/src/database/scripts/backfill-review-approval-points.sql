-- ===================================================================
-- Backfill review_approved point awards for (course, student) pairs
-- where both course and instructor reviews are approved (or course
-- has no instructor) but no ledger row exists yet.
--
-- Idempotent — UNIQUE constraint on idempotency_key prevents duplicates.
-- Safe to re-run.
-- ===================================================================

INSERT INTO point_transactions (
  user_id,
  delta,
  reason,
  rule_id,
  source_entity_type,
  source_entity_id,
  idempotency_key,
  expires_at,
  created_at
)
SELECT
  cr.student_id,
  pr.points_amount,
  'earn:review_approved',
  pr.id,
  'course',
  cr.course_id,
  'review_approved:' || cr.course_id || ':' || cr.student_id,
  CASE
    WHEN pr.expires_after_days IS NOT NULL
      THEN NOW() + (pr.expires_after_days || ' days')::INTERVAL
    ELSE NULL
  END,
  NOW()
FROM course_ratings cr
JOIN courses c ON c.id = cr.course_id
LEFT JOIN instructor_ratings ir
  ON ir.course_id = cr.course_id
  AND ir.student_id = cr.student_id
JOIN point_rules pr
  ON pr.rule_key = 'review_approved'
  AND pr.is_active = TRUE
WHERE cr.moderation_status = 'approved'
  AND (
    c.instructor_id IS NULL
    OR ir.moderation_status = 'approved'
  )
ON CONFLICT (idempotency_key) DO NOTHING;
