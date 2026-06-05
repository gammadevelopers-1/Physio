-- Migration 0054: Multiple attachments per ticket
--
-- The `tickets.attachment_url` column stays for backwards compatibility
-- with existing rows and the simple "one file" code paths still in
-- circulation. New attachments — single or multiple — go into this
-- junction table. Each row carries enough metadata for the chip UI
-- and for the attachment scan / download log to address a single file.
--
-- Reply-level attachments would use the same shape — they're out of
-- scope for this batch but the schema doesn't preclude them; we can
-- nullable-FK to ticket_replies later if needed.

CREATE TABLE IF NOT EXISTS "ticket_attachments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" UUID NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  -- URL into our own storage (validated origin + extension at the
  -- service layer — see validateTicketAttachmentUrl in support.service).
  "url" VARCHAR(500) NOT NULL,
  -- Best-effort original filename for display. Optional because the
  -- guest tracker upload route may not preserve it.
  "filename" VARCHAR(255),
  -- Best-effort size in bytes (-1 = unknown). Used to show a chip
  -- weight without re-fetching the file.
  "size_bytes" INTEGER NOT NULL DEFAULT -1,
  "mime_type" VARCHAR(100),
  -- Author of the upload. Nullable so guest uploads (no user row) and
  -- staff uploads (a future feature) both fit.
  "uploaded_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "uploaded_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ticket_attachments_ticket_idx"
  ON "ticket_attachments" ("ticket_id");

-- Same URL twice on the same ticket is a UI mistake (double-click). The
-- partial unique index dedupes silently rather than erroring.
CREATE UNIQUE INDEX IF NOT EXISTS "ticket_attachments_ticket_url_uniq"
  ON "ticket_attachments" ("ticket_id", "url");
