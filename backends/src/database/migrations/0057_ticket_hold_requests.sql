-- Migration 0057: Hold-approval workflow
--
-- Agents can no longer flip a ticket directly to ON_HOLD. They submit
-- a request which a supervisor or admin must approve before the
-- ticket's status actually changes. This table holds the request
-- audit + decision record.
--
-- Status lifecycle:
--   pending   → fresh submission, awaiting decision
--   approved  → supervisor/admin OK'd it, ticket moved to ON_HOLD
--   rejected  → supervisor/admin denied; ticket stays as-is
--   cancelled → requester withdrew before a decision was made
--
-- Reason matches the existing on_hold_reason check on tickets so a
-- migration of an existing on-hold ticket through this table is a
-- no-op. The `description` column is required only when reason='other'
-- — enforcement is at the service layer.
--
-- Note: there's no `IF EXISTS` skip on the journal — this table is
-- always created fresh. The unique partial index ensures only ONE
-- pending request can exist per ticket at any time, so a double-submit
-- race lands one row and the second sees a 23505 constraint violation.

CREATE TABLE IF NOT EXISTS "ticket_hold_requests" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" UUID NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "requested_by" UUID NOT NULL REFERENCES "users"("id"),
  "reason" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "decided_by" UUID REFERENCES "users"("id"),
  "decided_at" TIMESTAMP,
  "decision_note" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT "hold_req_status_check"
    CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled')),
  CONSTRAINT "hold_req_decided_when_resolved"
    CHECK (
      ("status" = 'pending' AND "decided_by" IS NULL AND "decided_at" IS NULL)
      OR ("status" = 'cancelled' AND "decided_by" IS NULL)
      OR ("status" IN ('approved', 'rejected') AND "decided_by" IS NOT NULL AND "decided_at" IS NOT NULL)
    )
);

-- Latest pending row by ticket — drives the banner in ticket detail.
CREATE INDEX IF NOT EXISTS "hold_req_ticket_status_idx"
  ON "ticket_hold_requests" ("ticket_id", "status");

-- One pending request per ticket — enforced at the DB so two agents
-- submitting back-to-back can't both wait for a decision.
CREATE UNIQUE INDEX IF NOT EXISTS "hold_req_one_pending_per_ticket"
  ON "ticket_hold_requests" ("ticket_id")
  WHERE "status" = 'pending';

-- For the supervisor's "pending decisions" badge.
CREATE INDEX IF NOT EXISTS "hold_req_pending_created_idx"
  ON "ticket_hold_requests" ("created_at" DESC)
  WHERE "status" = 'pending';
