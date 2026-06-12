-- Migration 0055: Per-reply attachments
--
-- Staff (agents + supervisors) can now attach files to individual
-- replies, not just to the initial ticket. The new column is nullable:
--   - reply_id IS NULL  → ticket-level attachment (the student's
--                          original upload, or any other ticket-scoped
--                          file). Existing rows stay this way.
--   - reply_id IS NOT NULL → attached to a specific reply; surfaces
--                            inline with that comment in the thread.
--
-- ON DELETE CASCADE so cleaning up a reply removes its attachments
-- without orphaning rows.

ALTER TABLE "ticket_attachments"
  ADD COLUMN IF NOT EXISTS "reply_id" UUID
  REFERENCES "ticket_replies"("id") ON DELETE CASCADE;

-- Hot-path index for fetching all attachments on a reply (the staff
-- thread renderer loads these inline per comment).
CREATE INDEX IF NOT EXISTS "ticket_attachments_reply_idx"
  ON "ticket_attachments" ("reply_id")
  WHERE "reply_id" IS NOT NULL;
