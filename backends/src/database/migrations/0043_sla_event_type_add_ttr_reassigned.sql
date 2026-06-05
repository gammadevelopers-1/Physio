-- Migration: Add 'ttr_breach_reassigned' to sla_events event_type CHECK constraint
--
-- Why: Migration 0038 widened the CHECK to 7 event types but missed
-- 'ttr_breach_reassigned'. The code in sla-monitor.service.ts writes this
-- value, which would fail the CHECK and crash the TTR-breach reassignment
-- cron path. This migration adds the missing value so the full 8-type
-- enum is allowed.
--
-- Safe to apply: drop-and-re-add of CHECK with the same name. No data
-- changes, no row writes. Existing rows already match a subset of the
-- new enum.

ALTER TABLE "sla_events" DROP CONSTRAINT IF EXISTS "sla_event_type_check";
ALTER TABLE "sla_events" ADD CONSTRAINT "sla_event_type_check"
  CHECK ("event_type" IN (
    'frt_breach', 'ttr_breach', 'escalation_triggered', 'resolved_within_sla',
    'frt_warning_75', 'priority_escalated',
    'frt_breach_reassigned', 'ttr_breach_reassigned'
  ));
