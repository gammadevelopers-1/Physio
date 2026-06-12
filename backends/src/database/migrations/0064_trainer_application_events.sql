-- Migration 0064 — Trainer application history + structured missing requirements
--
-- Two changes:
--   1. New table `role_request_events` — append-only audit of every state
--      transition (submit, approve, reject, request_info, resubmit). Solves
--      the existing single-slot review-fields problem where resubmits nulled
--      out the prior reviewer's notes, losing history.
--   2. New column `role_requests.missing_requirements` — structured checklist
--      of what's missing when status = MORE_INFO. Codes like CV_MISSING /
--      SCFHS_VERIFICATION; OTHER pairs with a free-text label.
--
-- Backfill: for every existing role_request, insert a 'submitted' event.
-- For reviewed ones (reviewed_at IS NOT NULL), insert a second event
-- mirroring the current status. Old overwritten review notes are
-- unrecoverable — going forward, every transition is preserved.

CREATE TABLE IF NOT EXISTS role_request_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_request_id uuid NOT NULL REFERENCES role_requests(id) ON DELETE CASCADE,
  action          varchar(30) NOT NULL,
  performed_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  note            text,
  missing_requirements jsonb,
  metadata        jsonb,
  created_at      timestamp NOT NULL DEFAULT now(),
  CONSTRAINT role_request_events_action_check
    CHECK (action IN ('submitted', 'approved', 'rejected', 'requested_info', 'resubmitted'))
);

CREATE INDEX IF NOT EXISTS role_request_events_request_id_idx
  ON role_request_events(role_request_id);
CREATE INDEX IF NOT EXISTS role_request_events_created_at_idx
  ON role_request_events(created_at);
CREATE INDEX IF NOT EXISTS role_request_events_action_idx
  ON role_request_events(action);

ALTER TABLE role_requests
  ADD COLUMN IF NOT EXISTS missing_requirements jsonb;

-- Backfill: 'submitted' event for every existing role_request, dated to
-- the row's created_at so the timeline starts at the right moment.
INSERT INTO role_request_events (role_request_id, action, performed_by, note, created_at)
SELECT rr.id, 'submitted', NULL, NULL, rr.created_at
FROM role_requests rr
WHERE NOT EXISTS (
  SELECT 1 FROM role_request_events e
  WHERE e.role_request_id = rr.id AND e.action = 'submitted'
);

-- Backfill: terminal/intermediate review event for every reviewed row.
-- 'PENDING' rows that somehow have a reviewed_at are skipped (current
-- code never produces that combination, but the WHERE keeps it safe).
INSERT INTO role_request_events
  (role_request_id, action, performed_by, note, created_at)
SELECT
  rr.id,
  CASE rr.status
    WHEN 'APPROVED'  THEN 'approved'
    WHEN 'REJECTED'  THEN 'rejected'
    WHEN 'MORE_INFO' THEN 'requested_info'
  END,
  rr.reviewed_by,
  rr.review_note,
  rr.reviewed_at
FROM role_requests rr
WHERE rr.reviewed_at IS NOT NULL
  AND rr.status IN ('APPROVED', 'REJECTED', 'MORE_INFO')
  AND NOT EXISTS (
    SELECT 1 FROM role_request_events e
    WHERE e.role_request_id = rr.id
      AND e.action IN ('approved', 'rejected', 'requested_info')
  );
