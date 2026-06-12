-- Migration 0070 — ticket escalation flags
--
-- Adds explicit escalation state to the tickets table. Until now,
-- "escalation" was implicit — derived from SLA breach flags + cron
-- reassignment activity. That makes "is this ticket escalated?" a
-- multi-table read and gives the FE no clean signal for the
-- ESCALATED chip + filter.
--
-- Three new columns:
--   * escalated_at        — when the ticket was first escalated
--                           (manual OR automatic). Set once and
--                           kept — escalation is sticky for audit.
--   * escalated_by        — UUID of the user who manually triggered
--                           the escalation. NULL when the breach
--                           cron triggered it (system-driven).
--   * escalation_reason   — Free-text reason captured from the
--                           supervisor's modal. NULL for cron-
--                           driven escalations.
--
-- Also extends the sla_events check constraint to accept
-- 'manual_escalation' so the audit row can record who escalated
-- and when alongside the existing breach/reassignment events.

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS escalated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

CREATE INDEX IF NOT EXISTS tickets_escalated_at_idx
  ON tickets (escalated_at)
  WHERE escalated_at IS NOT NULL;

-- Widen the sla_events type whitelist to admit 'manual_escalation'.
-- Drop + recreate is the safest path with Postgres check constraints
-- (no DDL to "extend" them in place).
ALTER TABLE sla_events
  DROP CONSTRAINT IF EXISTS sla_event_type_check;

ALTER TABLE sla_events
  ADD CONSTRAINT sla_event_type_check CHECK (
    event_type IN (
      'frt_breach',
      'ttr_breach',
      'escalation_triggered',
      'resolved_within_sla',
      'frt_warning_75',
      'priority_escalated',
      'frt_breach_reassigned',
      'ttr_breach_reassigned',
      'manual_escalation'
    )
  );
