-- Migration 0075 — Status page view tracking
--
-- Tracks public status page views so the admin Analytics panel can
-- report "X people checked the status page this month" and "Y users
-- viewed incident Z". Cookie-deduplicated server-side: a session
-- hash + 30-minute window collapse refreshes into a single view.
--
-- No PII stored — only SHA-256 hashes of IP and cookie value. The
-- raw IP never lands in the DB. This keeps us out of GDPR-grade
-- analytics territory while still giving useful counts.

CREATE TABLE IF NOT EXISTS status_page_view_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Set when viewing a specific incident page; null for general
  -- /status page views.
  incident_id   UUID REFERENCES service_status_incidents(id) ON DELETE SET NULL,
  viewed_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_hash       VARCHAR(64),
  session_hash  VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS status_view_viewed_at_idx
  ON status_page_view_events (viewed_at);

CREATE INDEX IF NOT EXISTS status_view_incident_idx
  ON status_page_view_events (incident_id)
  WHERE incident_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS status_view_dedup_idx
  ON status_page_view_events (session_hash, viewed_at);
