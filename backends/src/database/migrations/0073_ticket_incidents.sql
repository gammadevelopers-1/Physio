-- Migration 0073 — Ticket ↔ Incident bridge + incident audience/report fields
--
-- Lets Support agents link individual tickets to a known service-status
-- incident, so when an incident is resolved every affected ticket can
-- get a system-generated heads-up (and optionally close together). Also
-- adds the fields the admin "incident report" view + cross-dashboard
-- banners need:
--
--  • audience               — 'internal' (default; ops/dev incidents)
--                              vs 'end_users' (user-facing — shows in
--                              dashboard banner + sends notifications)
--  • affected_roles         — which role dashboards see the banner /
--                              get notified (Student / Instructor /
--                              Course Manager / TA / Finance). Admin
--                              + Support never appear here — they're
--                              managing the incident.
--  • root_cause             — post-mortem free text
--  • corrective_actions     — post-mortem free text
--  • linked_resolution_strategy — captured when the admin resolves an
--                              incident with linked tickets; drives
--                              what happens to those tickets:
--                                'soft_resolve' (default) — system
--                                  reply + transition to ON_HOLD so the
--                                  agent can close after user confirms
--                                'auto_close' — system reply + close
--                                'leave_open' — system reply only

ALTER TABLE service_status_incidents
  ADD COLUMN IF NOT EXISTS audience VARCHAR(20) NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS affected_roles TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS root_cause TEXT,
  ADD COLUMN IF NOT EXISTS corrective_actions TEXT,
  ADD COLUMN IF NOT EXISTS linked_resolution_strategy VARCHAR(20);

ALTER TABLE service_status_incidents
  DROP CONSTRAINT IF EXISTS service_status_incidents_audience_check;

ALTER TABLE service_status_incidents
  ADD CONSTRAINT service_status_incidents_audience_check
  CHECK (audience IN ('internal', 'end_users'));

ALTER TABLE service_status_incidents
  DROP CONSTRAINT IF EXISTS service_status_incidents_strategy_check;

ALTER TABLE service_status_incidents
  ADD CONSTRAINT service_status_incidents_strategy_check
  CHECK (
    linked_resolution_strategy IS NULL
    OR linked_resolution_strategy IN ('soft_resolve', 'auto_close', 'leave_open')
  );

-- Join table — one row per (ticket, incident). Unique enforced so a
-- ticket can't be linked to the same incident twice. ON DELETE CASCADE
-- on both FKs because if either side is hard-deleted, the link is
-- meaningless. We don't soft-delete — unlink = remove the row.

CREATE TABLE IF NOT EXISTS ticket_incidents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES service_status_incidents(id) ON DELETE CASCADE,
  linked_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  linked_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (ticket_id, incident_id)
);

CREATE INDEX IF NOT EXISTS ticket_incidents_ticket_idx
  ON ticket_incidents (ticket_id);

CREATE INDEX IF NOT EXISTS ticket_incidents_incident_idx
  ON ticket_incidents (incident_id);
