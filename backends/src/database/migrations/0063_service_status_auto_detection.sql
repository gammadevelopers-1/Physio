-- Migration 0063: Auto-detection layer on service status components.
--
-- Until now status was fully admin-driven. This migration adds an
-- auto-check pipeline that runs every 5 minutes and populates a
-- separate `auto_status` column. The admin's manual flip becomes a
-- "manual override" that wins when present, otherwise the public
-- page shows the auto-detected state.
--
-- Resulting precedence: manual_override_status > auto_status > 'operational'
--
-- Three check types ship with this migration:
--
--   • internal_db — runs SELECT 1 against our own DB. Powers the
--     Platform component. Fails closed: if the DB is unreachable,
--     this cron also can't run, so the staleness of auto_checked_at
--     is itself a signal.
--
--   • statuspage — fetches an Atlassian Statuspage JSON
--     (https://<host>/api/v2/status.json) and maps its 4-state
--     'indicator' field to our 5-state component status. Powers
--     Zoom (Webinars) + Resend (Email).
--
--   • manual — no auto-check; component status is whatever the
--     admin last set. Payment uses this until a real gateway is
--     wired (the placeholder always succeeds, so an auto-check
--     would just lie).
--
-- Manual override columns are nullable — NULL means "no override,
-- show auto". Admin UI clears the override by setting them back
-- to NULL.

ALTER TABLE "service_status_components"
  ADD COLUMN IF NOT EXISTS "check_type" VARCHAR(30) NOT NULL DEFAULT 'manual';

ALTER TABLE "service_status_components"
  ADD COLUMN IF NOT EXISTS "check_config" JSONB;

ALTER TABLE "service_status_components"
  ADD COLUMN IF NOT EXISTS "auto_status" VARCHAR(30);

ALTER TABLE "service_status_components"
  ADD COLUMN IF NOT EXISTS "auto_checked_at" TIMESTAMP;

ALTER TABLE "service_status_components"
  ADD COLUMN IF NOT EXISTS "auto_error" TEXT;

ALTER TABLE "service_status_components"
  ADD COLUMN IF NOT EXISTS "manual_override_status" VARCHAR(30);

ALTER TABLE "service_status_components"
  ADD COLUMN IF NOT EXISTS "manual_override_set_at" TIMESTAMP;

ALTER TABLE "service_status_components"
  ADD COLUMN IF NOT EXISTS "manual_override_set_by" UUID
  REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "service_status_components"
  DROP CONSTRAINT IF EXISTS "service_status_components_check_type_check";

ALTER TABLE "service_status_components"
  ADD CONSTRAINT "service_status_components_check_type_check"
  CHECK ("check_type" IN ('manual', 'internal_db', 'statuspage'));

ALTER TABLE "service_status_components"
  DROP CONSTRAINT IF EXISTS "service_status_components_auto_status_check";

ALTER TABLE "service_status_components"
  ADD CONSTRAINT "service_status_components_auto_status_check"
  CHECK (
    "auto_status" IS NULL OR
    "auto_status" IN (
      'operational',
      'degraded',
      'partial_outage',
      'major_outage',
      'maintenance'
    )
  );

ALTER TABLE "service_status_components"
  DROP CONSTRAINT IF EXISTS "service_status_components_manual_override_status_check";

ALTER TABLE "service_status_components"
  ADD CONSTRAINT "service_status_components_manual_override_status_check"
  CHECK (
    "manual_override_status" IS NULL OR
    "manual_override_status" IN (
      'operational',
      'degraded',
      'partial_outage',
      'major_outage',
      'maintenance'
    )
  );

-- Backfill: anything an admin has already manually set (via the
-- old admin panel that wrote directly to current_status) becomes
-- a manual override now. The auto-check loop will then populate
-- auto_status on its first run. Until then, public reads still
-- return the same current_status as before.

UPDATE "service_status_components"
SET
  "manual_override_status" = "current_status",
  "manual_override_set_at" = "updated_at",
  "manual_override_set_by" = "updated_by"
WHERE "current_status" IS NOT NULL
  AND "current_status" != 'operational';

-- Seed check_type + check_config per the three components that
-- have real auto-checkers. Payment stays 'manual' until a real
-- gateway is wired.

UPDATE "service_status_components"
SET
  "check_type" = 'internal_db',
  "check_config" = '{}'::jsonb
WHERE "key" = 'platform';

UPDATE "service_status_components"
SET
  "check_type" = 'statuspage',
  "check_config" = jsonb_build_object(
    'url', 'https://status.zoom.us/api/v2/status.json'
  )
WHERE "key" = 'webinar';

UPDATE "service_status_components"
SET
  "check_type" = 'statuspage',
  "check_config" = jsonb_build_object(
    'url', 'https://status.resend.com/api/v2/status.json'
  )
WHERE "key" = 'email';

-- Payment stays 'manual' (default). Admin sees a hint about wiring
-- a real gateway and can switch the check_type from the admin panel
-- later — no migration needed.
