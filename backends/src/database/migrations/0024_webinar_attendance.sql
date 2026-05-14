-- Track webinar attendance directly on the registration row.
-- Webinars are info-only for enrolled students (do not contribute to
-- course progress) so we deliberately do NOT mirror these into the
-- `attendance` table. The manager-side registrants drawer reads
-- attended / joined_at / left_at / attended_duration straight from here.

ALTER TABLE webinar_registrations
  ADD COLUMN IF NOT EXISTS attended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS joined_at timestamp,
  ADD COLUMN IF NOT EXISTS left_at timestamp,
  ADD COLUMN IF NOT EXISTS attended_duration_minutes integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS webinar_registrations_attended_idx
  ON webinar_registrations(session_id, attended);
