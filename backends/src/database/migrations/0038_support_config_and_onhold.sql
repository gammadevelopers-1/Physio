-- Migration: Support Config table + On-Hold tracking columns + SLA event types expansion
-- Section 1: Admin Configures the System

-- 1. Create support_config key-value table for round-robin pointer and system state
CREATE TABLE IF NOT EXISTS "support_config" (
  "key" VARCHAR(100) PRIMARY KEY,
  "value" JSON NOT NULL,
  "updated_at" TIMESTAMP DEFAULT now() NOT NULL
);

-- Seed round-robin pointer at index 0
INSERT INTO "support_config" ("key", "value")
VALUES ('round_robin_pointer', '0')
ON CONFLICT ("key") DO NOTHING;

-- 2. Add on-hold tracking columns to tickets
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "on_hold_total_minutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "on_hold_resumed_at" TIMESTAMP;

-- 3. Expand sla_events event_type check to include new event types
ALTER TABLE "sla_events" DROP CONSTRAINT IF EXISTS "sla_event_type_check";
ALTER TABLE "sla_events" ADD CONSTRAINT "sla_event_type_check"
  CHECK ("event_type" IN (
    'frt_breach', 'ttr_breach', 'escalation_triggered', 'resolved_within_sla',
    'frt_warning_75', 'priority_escalated', 'frt_breach_reassigned'
  ));
