-- Migration 0074 — Scheduled maintenance windows
--
-- Lets admins schedule maintenance in advance instead of toggling
-- the live switch ad-hoc. A small cron flips system_settings.
-- maintenance.enabled ON at start_at and OFF at end_at, and fires
-- pre-notifications (banner + email + in-app) some configurable
-- number of minutes before the window opens.
--
-- The manual ON/OFF toggle still works in parallel — schedules
-- don't replace it, they just automate the planned-work flow.

CREATE TABLE IF NOT EXISTS scheduled_maintenance_windows (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_en                        VARCHAR(200) NOT NULL,
  title_ar                        VARCHAR(200),
  description_en                  TEXT,
  description_ar                  TEXT,
  -- Affected components list — reuses service_status_components.key
  -- values (zoom, payment, email, etc.). Optional; empty = unspecified.
  affected_components             TEXT[] NOT NULL DEFAULT '{}'::text[],
  start_at                        TIMESTAMP NOT NULL,
  end_at                          TIMESTAMP NOT NULL,
  -- How many minutes before start_at to send the heads-up. Default
  -- 60. Set to 0 to skip pre-notification entirely.
  pre_notification_lead_minutes   INTEGER NOT NULL DEFAULT 60,
  pre_notification_sent_at        TIMESTAMP,
  -- Lifecycle: scheduled → active → completed (or cancelled at any
  -- point before active). The cron transitions scheduled→active at
  -- start_at, active→completed at end_at.
  status                          VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  created_by                      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at                      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT scheduled_maintenance_status_check
    CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  CONSTRAINT scheduled_maintenance_end_after_start
    CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS scheduled_maintenance_status_idx
  ON scheduled_maintenance_windows (status);

CREATE INDEX IF NOT EXISTS scheduled_maintenance_start_idx
  ON scheduled_maintenance_windows (start_at);

CREATE INDEX IF NOT EXISTS scheduled_maintenance_end_idx
  ON scheduled_maintenance_windows (end_at);
