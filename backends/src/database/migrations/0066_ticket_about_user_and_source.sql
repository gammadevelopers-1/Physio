-- Migration 0066 — about_user_id + source on tickets
--
-- Models tickets that are filed BY one party ABOUT another. Originally
-- driven by the instructor's At-Risk Interventions flow: an instructor
-- raises a "support follow-up" ticket about a struggling student. The
-- instructor is the requester (tickets.student_id), the student is the
-- subject (tickets.about_user_id), the support agent is the assignee.
--
-- Two columns:
--   * about_user_id   nullable FK to users — set when the ticket is
--                     about a third party (NULL for normal tickets).
--                     Supervisor + admin UI render an "About this
--                     student" context card when this is populated.
--                     ON DELETE SET NULL so deleting a user doesn't
--                     orphan support audit history; the ticket still
--                     exists, the subject reference just goes empty.
--   * source          nullable text — provenance of the ticket. Known
--                     values: 'intervention' (filed via instructor
--                     at-risk dashboard), 'at_risk_alert' (future),
--                     'direct' = NULL. Lets us filter / report on
--                     intervention-driven tickets without scanning
--                     metadata.
--
-- An index on about_user_id supports the "show me all tickets
-- mentioning this student" query that the support agent will run when
-- triaging the follow-up.

ALTER TABLE tickets
  ADD COLUMN about_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN source VARCHAR(30);

CREATE INDEX IF NOT EXISTS tickets_about_user_id_idx
  ON tickets (about_user_id)
  WHERE about_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tickets_source_idx
  ON tickets (source)
  WHERE source IS NOT NULL;
