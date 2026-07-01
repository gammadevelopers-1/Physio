-- NELC xAPI transmission log
--
-- Every learner-journey event (login, course enrolment, lesson watch,
-- assessment attempt, course completion, certificate issued, etc.) is
-- assembled into an xAPI statement and POSTed to NELC's LRS at
-- https://lrs.nelc.gov.sa/lrs-license-stg/xapi/statements.
--
-- We persist the statement BEFORE attempting transmission so that:
--   1. A retry after a network blip can find the row and re-POST without
--      losing the actor/object/timestamp context.
--   2. The admin "Transmission Log" UI can show every statement we tried
--      to send, with its full JSON body and the response NELC returned.
--   3. NELC's validator (Amna runs it by learner national_id) can be
--      cross-checked against what we believe we sent.
--
-- xapi_statements    — the canonical statement (one row per event)
-- xapi_transmissions — one row per POST attempt to the LRS

CREATE TABLE IF NOT EXISTS xapi_statements (
  -- The xAPI statement id. We generate it here so the same UUID can be
  -- sent in the statement body (xAPI spec field `id`) — making the POST
  -- idempotent on the LRS side per the spec.
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Verb id (full IRI from the NELC-supported set: registered,
  -- initialized, watched, completed, attempted, rated, earned,
  -- progressed, logged-in). Indexed for the admin table's verb filter.
  verb TEXT NOT NULL,

  -- Actor — the learner. user_id is the FK; the encrypted national_id /
  -- email live on users so we don't duplicate PII here. Nullable only
  -- to allow system-level statements (none today, kept open for future).
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Object — the xAPI activity (course, module, lesson, video, assessment,
  -- certificate, platform). object_activity_id holds the canonical URL
  -- we send as `object.id`. object_type is the activity-type IRI.
  object_activity_id TEXT NOT NULL,
  object_type TEXT NOT NULL,

  -- Optional pointers to source rows — let the admin UI link back to the
  -- enrollment / submission / certificate that generated this statement.
  -- All nullable + ON DELETE SET NULL so a deleted source doesn't break
  -- the audit trail (the JSONB payload is still authoritative).
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,

  -- Full statement body exactly as POSTed. Source of truth for the LRS
  -- replay if we ever need it; also what the admin "view JSON" panel
  -- renders. JSONB so we can query on extension keys without parsing.
  payload JSONB NOT NULL,

  -- pending → first POST not yet attempted
  -- sent    → LRS returned 2xx
  -- failed  → LRS returned non-2xx (or network error) after final retry
  -- Indexed for the cron flush which scans for failed/pending rows.
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  -- Set on the first successful transmission (NULL while pending/failed).
  sent_at TIMESTAMP,

  CONSTRAINT xapi_statements_status_check
    CHECK (status IN ('pending', 'sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_xapi_statements_status_created
  ON xapi_statements(status, created_at);
CREATE INDEX IF NOT EXISTS idx_xapi_statements_actor
  ON xapi_statements(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_xapi_statements_course
  ON xapi_statements(course_id);
CREATE INDEX IF NOT EXISTS idx_xapi_statements_verb
  ON xapi_statements(verb);
CREATE INDEX IF NOT EXISTS idx_xapi_statements_created
  ON xapi_statements(created_at DESC);

CREATE TABLE IF NOT EXISTS xapi_transmissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL
    REFERENCES xapi_statements(id) ON DELETE CASCADE,

  -- 1-indexed attempt counter. First POST = 1, first retry = 2, etc.
  attempt_no INT NOT NULL,

  -- HTTP status from the LRS (NULL when the request never made it —
  -- DNS, timeout, abort). When NULL, error_text carries the cause.
  http_status INT,
  -- LRS response body (trimmed). xAPI 200/204 returns empty or a
  -- statement-id list; we keep it for forensics.
  response_body TEXT,
  -- Captured exception message when the request failed before/after
  -- getting a response. Diagnostic-only, never user-facing.
  error_text TEXT,

  sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xapi_transmissions_statement
  ON xapi_transmissions(statement_id);
CREATE INDEX IF NOT EXISTS idx_xapi_transmissions_sent
  ON xapi_transmissions(sent_at DESC);
