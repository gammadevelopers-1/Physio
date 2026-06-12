-- Migration 0062: Public service-status page foundation.
--
-- Three tables that power both the user-facing /status page and the
-- admin "Service Status" panel under Settings → System:
--
--   1) service_status_components — one row per public-facing
--      component. Seeded with the four named by the client
--      (platform, webinar, email, payment). Admins can later add
--      more via the admin UI; the key is the stable identifier
--      that the public page reads.
--
--   2) service_status_incidents — one row per incident (open or
--      resolved). `affected_components` is a text[] of component
--      keys so a single incident can span multiple components
--      (e.g. webhooks down → both webinar AND email degraded).
--
--   3) service_status_incident_updates — one row per timeline
--      message on an incident. Status field doubles as the
--      incident's current status (the latest update wins). Keeps
--      the timeline immutable + auditable rather than
--      overwriting incident.status on every edit.
--
-- Status enums are kept loose (varchar + CHECK) so we can extend
-- them later without a migration. The admin form will gate to the
-- canonical set; raw SQL inserts have the CHECK as a backstop.

CREATE TABLE IF NOT EXISTS "service_status_components" (
  "key" VARCHAR(50) PRIMARY KEY,
  "name_en" VARCHAR(100) NOT NULL,
  "name_ar" VARCHAR(100),
  "description_en" TEXT,
  "description_ar" TEXT,
  "current_status" VARCHAR(30) NOT NULL DEFAULT 'operational',
  "current_message_en" TEXT,
  "current_message_ar" TEXT,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "service_status_components_status_check"
    CHECK ("current_status" IN (
      'operational',
      'degraded',
      'partial_outage',
      'major_outage',
      'maintenance'
    ))
);

CREATE INDEX IF NOT EXISTS "service_status_components_display_order_idx"
  ON "service_status_components" ("display_order");

CREATE TABLE IF NOT EXISTS "service_status_incidents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title_en" VARCHAR(200) NOT NULL,
  "title_ar" VARCHAR(200),
  "affected_components" TEXT[] NOT NULL DEFAULT '{}',
  "current_status" VARCHAR(30) NOT NULL DEFAULT 'investigating',
  "severity" VARCHAR(20) NOT NULL DEFAULT 'minor',
  "started_at" TIMESTAMP NOT NULL DEFAULT now(),
  "resolved_at" TIMESTAMP,
  "created_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "service_status_incidents_status_check"
    CHECK ("current_status" IN (
      'investigating',
      'identified',
      'monitoring',
      'resolved'
    )),
  CONSTRAINT "service_status_incidents_severity_check"
    CHECK ("severity" IN ('minor', 'major', 'critical'))
);

CREATE INDEX IF NOT EXISTS "service_status_incidents_resolved_at_idx"
  ON "service_status_incidents" ("resolved_at");

CREATE INDEX IF NOT EXISTS "service_status_incidents_started_at_idx"
  ON "service_status_incidents" ("started_at");

CREATE TABLE IF NOT EXISTS "service_status_incident_updates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "incident_id" UUID NOT NULL REFERENCES "service_status_incidents"("id") ON DELETE CASCADE,
  "status" VARCHAR(30) NOT NULL,
  "message_en" TEXT NOT NULL,
  "message_ar" TEXT,
  "posted_at" TIMESTAMP NOT NULL DEFAULT now(),
  "posted_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "service_status_incident_updates_status_check"
    CHECK ("status" IN ('investigating', 'identified', 'monitoring', 'resolved'))
);

CREATE INDEX IF NOT EXISTS "service_status_incident_updates_incident_id_idx"
  ON "service_status_incident_updates" ("incident_id");

CREATE INDEX IF NOT EXISTS "service_status_incident_updates_posted_at_idx"
  ON "service_status_incident_updates" ("posted_at");

-- Seed the 4 components the client named. ON CONFLICT keeps this
-- idempotent so re-running the migration on a populated database
-- is a no-op.

INSERT INTO "service_status_components" (
  "key", "name_en", "name_ar", "description_en", "description_ar",
  "display_order"
) VALUES
  ('platform', 'Platform', 'المنصة',
   'Web application, course access, dashboards.',
   'تطبيق الويب، الوصول إلى الدورات، لوحات التحكم.',
   10),
  ('webinar', 'Webinars (Zoom)', 'الندوات (Zoom)',
   'Live webinar sessions and recording delivery.',
   'جلسات الندوات المباشرة ومشاركة التسجيلات.',
   20),
  ('email', 'Email delivery', 'البريد الإلكتروني',
   'Transactional emails (notifications, receipts, certificates).',
   'الرسائل الإلكترونية (التنبيهات، الإيصالات، الشهادات).',
   30),
  ('payment', 'Payment gateway', 'بوابة الدفع',
   'Checkout and order processing.',
   'المدفوعات ومعالجة الطلبات.',
   40)
ON CONFLICT ("key") DO NOTHING;
