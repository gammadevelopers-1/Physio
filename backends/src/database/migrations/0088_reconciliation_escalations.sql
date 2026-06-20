-- ===========================================
-- Reconciliation escalations — Phase E.1
-- ===========================================
-- When finance hits a reconciliation drift they can't resolve themselves
-- (e.g. missing_local means a student paid via Tabby but never got a
-- payment row on our side → needs manual enrollment, which finance can't
-- do), they escalate the finding to admin. This file adds:
--
--   1. reconciliation_escalations  — the escalation lifecycle
--   2. reconciliation_settings     — key/value store for cron thresholds,
--                                    feature toggles, etc.
--   3. Adds 'escalated' to the existing findings status CHECK so an
--      escalated finding is locked from finance Resolve/Ignore until the
--      admin closes the escalation (one of: resolved, sent_back, declined)
--   4. Adds escalation_id column on findings — denormalized pointer to the
--      latest escalation for fast lookup; the source of truth is the FK on
--      reconciliation_escalations.finding_id.

-- 1. Escalation lifecycle table.
CREATE TABLE IF NOT EXISTS reconciliation_escalations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id       uuid NOT NULL REFERENCES reconciliation_findings(id) ON DELETE CASCADE,
  escalated_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  escalated_at     timestamp NOT NULL DEFAULT now(),
  escalation_note  text NOT NULL,
  proposed_action  varchar(32) NOT NULL,
  urgency          varchar(16) NOT NULL DEFAULT 'normal',

  status           varchar(16) NOT NULL DEFAULT 'pending',
  claimed_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  claimed_at       timestamp,

  action_taken     varchar(32),
  resolution_note  text,
  resolved_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at      timestamp,

  -- Trace back to whatever entity admin created (enrollment, refund, etc.)
  linked_entity_type varchar(32),
  linked_entity_id   uuid,

  created_at       timestamp NOT NULL DEFAULT now(),
  updated_at       timestamp NOT NULL DEFAULT now(),

  CONSTRAINT reconciliation_escalations_status_check
    CHECK (status IN ('pending', 'in_progress', 'resolved', 'declined', 'sent_back')),
  CONSTRAINT reconciliation_escalations_urgency_check
    CHECK (urgency IN ('low', 'normal', 'high')),
  CONSTRAINT reconciliation_escalations_proposed_action_check
    CHECK (proposed_action IN ('enroll', 'refund', 'investigate', 'other', 'system_inferred')),
  CONSTRAINT reconciliation_escalations_action_taken_check
    CHECK (action_taken IS NULL OR action_taken IN ('enrolled', 'refunded', 'no_action', 'sent_back')),
  -- One open escalation per finding. When the admin closes the escalation
  -- (resolved / declined / sent_back) finance can re-escalate if needed —
  -- the partial index allows multiple historical rows but only one active.
  CONSTRAINT reconciliation_escalations_finding_id_check
    CHECK (finding_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_escalations_active_per_finding_idx
  ON reconciliation_escalations(finding_id)
  WHERE status IN ('pending', 'in_progress');

CREATE INDEX IF NOT EXISTS reconciliation_escalations_status_idx
  ON reconciliation_escalations(status);
CREATE INDEX IF NOT EXISTS reconciliation_escalations_urgency_idx
  ON reconciliation_escalations(urgency)
  WHERE status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS reconciliation_escalations_escalated_by_idx
  ON reconciliation_escalations(escalated_by);
CREATE INDEX IF NOT EXISTS reconciliation_escalations_claimed_by_idx
  ON reconciliation_escalations(claimed_by);
CREATE INDEX IF NOT EXISTS reconciliation_escalations_finding_id_idx
  ON reconciliation_escalations(finding_id);
CREATE INDEX IF NOT EXISTS reconciliation_escalations_escalated_at_idx
  ON reconciliation_escalations(escalated_at DESC);

-- 2. Settings table — key/value for cron thresholds + feature flags.
--    Phase E.5 (cron) seeds the defaults; until then it stays empty and
--    the cron service falls back to compile-time defaults in code.
CREATE TABLE IF NOT EXISTS reconciliation_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- 3. Extend findings status to allow 'escalated'.
ALTER TABLE reconciliation_findings
  DROP CONSTRAINT IF EXISTS reconciliation_findings_status_check;

ALTER TABLE reconciliation_findings
  ADD CONSTRAINT reconciliation_findings_status_check
  CHECK (status IN ('unresolved', 'resolved', 'ignored', 'escalated'));

-- 4. Denormalized pointer for fast "latest escalation for this finding"
--    lookups. Nullable — most findings won't have an escalation. Updated
--    by the EscalationsService at create / close time.
ALTER TABLE reconciliation_findings
  ADD COLUMN IF NOT EXISTS escalation_id uuid
  REFERENCES reconciliation_escalations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reconciliation_findings_escalation_id_idx
  ON reconciliation_findings(escalation_id)
  WHERE escalation_id IS NOT NULL;
