-- ===========================================
-- 0046: Support team membership + admin-mediated agent-add requests
--
-- Adds two tables that let supervisors curate their own team without
-- bypassing the admin:
--   - support_team_members:  (supervisor, agent) link, one team per agent
--   - support_team_requests: supervisor → admin requests to add an agent
--
-- Idempotent — safe to re-run.
-- ===========================================

CREATE TABLE IF NOT EXISTS "support_team_members" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "supervisor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "agent_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "added_by"      uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "assigned_at"   timestamp NOT NULL DEFAULT now()
);

-- An agent belongs to at most one supervisor team at a time.
CREATE UNIQUE INDEX IF NOT EXISTS "support_team_members_agent_unique"
  ON "support_team_members" ("agent_id");

CREATE INDEX IF NOT EXISTS "support_team_members_supervisor_idx"
  ON "support_team_members" ("supervisor_id");


CREATE TABLE IF NOT EXISTS "support_team_requests" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "supervisor_id"        uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind"                 varchar(20) NOT NULL,
  "candidate_user_id"    uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "candidate_email"      varchar(320),
  "candidate_first_name" varchar(100),
  "candidate_last_name"  varchar(100),
  "candidate_phone"      varchar(40),
  "reason"               text,
  "status"               varchar(20) NOT NULL DEFAULT 'pending',
  "reviewed_by"          uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at"          timestamp,
  "decision_reason"      text,
  "created_at"           timestamp NOT NULL DEFAULT now(),
  "updated_at"           timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "support_team_requests_status_idx"
  ON "support_team_requests" ("status");

CREATE INDEX IF NOT EXISTS "support_team_requests_supervisor_idx"
  ON "support_team_requests" ("supervisor_id");

CREATE INDEX IF NOT EXISTS "support_team_requests_created_at_idx"
  ON "support_team_requests" ("created_at");
