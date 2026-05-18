-- Webinar Course "share recording" toggle. Default false — the manager
-- opts in per course. When false, the webinar recording stays inside Zoom
-- and the student dashboard never surfaces it. Non-Webinar courses ignore
-- the field (their per-session recording handling is unchanged).

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS recording_share_enabled BOOLEAN NOT NULL DEFAULT false;
