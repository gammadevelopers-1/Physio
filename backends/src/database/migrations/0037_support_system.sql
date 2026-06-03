-- Migration: Support Dashboard Foundation (Sprint 1)
-- Adds SLA tracking, internal notes, sub-roles, and support-related tables

-- ─── 1. Enhance tickets table ───────────────────────────────────

ALTER TABLE "tickets" ADD COLUMN "first_response_at" TIMESTAMP;
ALTER TABLE "tickets" ADD COLUMN "sla_breached_frt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tickets" ADD COLUMN "sla_breached_ttr" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tickets" ADD COLUMN "on_hold_reason" VARCHAR(100);
ALTER TABLE "tickets" ADD COLUMN "on_hold_at" TIMESTAMP;

-- Update status check constraint to include 'on_hold'
ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "tickets_status_check";
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_status_check"
  CHECK ("status" IN ('new', 'in_progress', 'on_hold', 'resolved', 'closed'));

-- ─── 2. Add is_internal to ticket_replies ───────────────────────

ALTER TABLE "ticket_replies" ADD COLUMN "is_internal" BOOLEAN NOT NULL DEFAULT false;

-- ─── 3. Add support_sub_role to user_roles ──────────────────────

ALTER TABLE "user_roles" ADD COLUMN "support_sub_role" VARCHAR(20);

-- ─── 4. Create sla_policies table ───────────────────────────────

CREATE TABLE IF NOT EXISTS "sla_policies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "priority" VARCHAR(10) NOT NULL UNIQUE,
  "frt_minutes" INTEGER NOT NULL,
  "ttr_minutes" INTEGER NOT NULL,
  "escalate_after_minutes" INTEGER NOT NULL,
  "escalate_to_role" VARCHAR(50),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP DEFAULT now() NOT NULL,
  CONSTRAINT "sla_priority_check" CHECK ("priority" IN ('high', 'medium', 'low'))
);

-- ─── 5. Create sla_events table ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "sla_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" UUID NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "event_type" VARCHAR(30) NOT NULL,
  "triggered_at" TIMESTAMP DEFAULT now() NOT NULL,
  "notified_user_ids" JSON,
  "resolved_within_sla" BOOLEAN,
  CONSTRAINT "sla_event_type_check" CHECK ("event_type" IN ('frt_breach', 'ttr_breach', 'escalation_triggered', 'resolved_within_sla'))
);

CREATE INDEX IF NOT EXISTS "sla_events_ticket_id_idx" ON "sla_events" ("ticket_id");
CREATE INDEX IF NOT EXISTS "sla_events_event_type_idx" ON "sla_events" ("event_type");

-- ─── 6. Create escalation_paths table ───────────────────────────

CREATE TABLE IF NOT EXISTS "escalation_paths" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(100) NOT NULL,
  "steps" JSON NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP DEFAULT now() NOT NULL
);

-- ─── 7. Create support_macros table ─────────────────────────────

CREATE TABLE IF NOT EXISTS "support_macros" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" VARCHAR(200) NOT NULL,
  "body_template" TEXT NOT NULL,
  "variables" JSON,
  "kb_article_urls" JSON,
  "escalation_path_id" UUID REFERENCES "escalation_paths"("id") ON DELETE SET NULL,
  "created_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP DEFAULT now() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "support_macros_created_by_idx" ON "support_macros" ("created_by");

-- ─── 8. Create csat_surveys table ───────────────────────────────

CREATE TABLE IF NOT EXISTS "csat_surveys" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" UUID NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "course_id" UUID REFERENCES "courses"("id") ON DELETE SET NULL,
  "score" INTEGER,
  "comment" TEXT,
  "channel" VARCHAR(20) NOT NULL DEFAULT 'email',
  "sent_at" TIMESTAMP DEFAULT now() NOT NULL,
  "submitted_at" TIMESTAMP,
  CONSTRAINT "csat_score_check" CHECK ("score" IS NULL OR ("score" >= 1 AND "score" <= 5)),
  CONSTRAINT "csat_channel_check" CHECK ("channel" IN ('email', 'sms', 'whatsapp')),
  CONSTRAINT "csat_surveys_ticket_user_unique" UNIQUE ("ticket_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "csat_surveys_ticket_id_idx" ON "csat_surveys" ("ticket_id");
CREATE INDEX IF NOT EXISTS "csat_surveys_user_id_idx" ON "csat_surveys" ("user_id");

-- ─── 9. Create nps_surveys table ────────────────────────────────

CREATE TABLE IF NOT EXISTS "nps_surveys" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "course_id" UUID REFERENCES "courses"("id") ON DELETE SET NULL,
  "score" INTEGER,
  "comment" TEXT,
  "channel" VARCHAR(20) NOT NULL DEFAULT 'email',
  "sent_at" TIMESTAMP DEFAULT now() NOT NULL,
  "submitted_at" TIMESTAMP,
  CONSTRAINT "nps_score_check" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 10)),
  CONSTRAINT "nps_channel_check" CHECK ("channel" IN ('email', 'sms', 'whatsapp'))
);

CREATE INDEX IF NOT EXISTS "nps_surveys_user_id_idx" ON "nps_surveys" ("user_id");

-- ─── 10. Create kb_articles table ───────────────────────────────

CREATE TABLE IF NOT EXISTS "kb_articles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title_ar" VARCHAR(300),
  "title_en" VARCHAR(300),
  "body_ar" TEXT,
  "body_en" TEXT,
  "category" VARCHAR(30) NOT NULL,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "author_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP DEFAULT now() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT now() NOT NULL,
  CONSTRAINT "kb_category_check" CHECK ("category" IN ('billing', 'login', 'content', 'certificate', 'technical', 'other'))
);

CREATE INDEX IF NOT EXISTS "kb_articles_category_idx" ON "kb_articles" ("category");
CREATE INDEX IF NOT EXISTS "kb_articles_published_idx" ON "kb_articles" ("published");

-- ─── 11. Seed default SLA policies ──────────────────────────────

INSERT INTO "sla_policies" ("priority", "frt_minutes", "ttr_minutes", "escalate_after_minutes", "escalate_to_role")
VALUES
  ('high', 30, 240, 30, 'SUPPORT'),
  ('medium', 120, 1440, 120, 'SUPPORT'),
  ('low', 480, 4320, 480, 'SUPPORT')
ON CONFLICT ("priority") DO NOTHING;
