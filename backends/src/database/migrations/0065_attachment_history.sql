-- Migration 0065 — Attachment soft-delete + version-history support
--
-- Two adds on ticket_attachments:
--   1. removed_at + removed_by — soft-delete pair. Removing an
--      attachment doesn't destroy the row; it stamps when/who and the
--      row drops out of the active list. The audit-trail timeline
--      surfaces the removed rows as historical entries.
--   2. sha256 — content fingerprint used to detect "same file
--      uploaded again" (informational only, no enforcement). Backfilled
--      lazily — existing rows stay null until next upload of that file.
--
-- All changes are additive + nullable so the existing get-ticket
-- path keeps working unchanged before the matching service updates
-- ship.

ALTER TABLE ticket_attachments
  ADD COLUMN IF NOT EXISTS removed_at timestamp,
  ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sha256     varchar(64);

CREATE INDEX IF NOT EXISTS ticket_attachments_removed_at_idx
  ON ticket_attachments(removed_at);
CREATE INDEX IF NOT EXISTS ticket_attachments_sha256_idx
  ON ticket_attachments(sha256);
