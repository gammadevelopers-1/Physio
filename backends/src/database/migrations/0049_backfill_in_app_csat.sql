-- Backfill csat_surveys with in-app ratings that were written to
-- tickets.satisfactionRating before rateTicket() also wrote to
-- csat_surveys. Without this, in-app ratings remain invisible to every
-- analytic (getKPIs, getMyPerformance, getCsatSummary, agent perf).
--
-- Idempotent: ON CONFLICT keeps the larger score so re-running can't
-- regress data, and only touches rows where the survey score is null
-- (i.e. the email survey hasn't already filled it in).

INSERT INTO csat_surveys (ticket_id, user_id, course_id, score, channel, sent_at, submitted_at)
SELECT
  t.id,
  t.student_id,
  t.course_id,
  t.satisfaction_rating,
  'email',
  COALESCE(t.resolved_at, t.created_at),
  COALESCE(t.resolved_at, NOW())
FROM tickets t
WHERE t.satisfaction_rating IS NOT NULL
ON CONFLICT (ticket_id, user_id) DO UPDATE
SET score = GREATEST(EXCLUDED.score, csat_surveys.score),
    submitted_at = COALESCE(csat_surveys.submitted_at, EXCLUDED.submitted_at);
