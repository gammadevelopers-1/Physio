-- Migration 0053: Support governance — merge, transfer, retention, scans.
--
-- Bundles a handful of small structural changes that all live under
-- "operational governance" so they ship in one round-trip:
--
--   1. tickets.merged_into_ticket_id — supports the new merge flow
--      (POST /tickets/:id/merge). When set, the row is closed and its
--      replies have been moved to the target. We keep the source row
--      around (instead of hard-deleting) so the audit trail is intact
--      and the merge can be undone manually if needed.
--
--   2. attachment_download_events — every ticket-attachment fetch by a
--      staff member is logged here. Students fetching their own files
--      are still gated by the support module's access check; we don't
--      need to log them because the row is for compliance review.
--
--   3. ticket_attachment_scans — wires the "antivirus" capability
--      Amna asked for. We don't run ClamAV inside Cloud Run; instead
--      this table records the result of whichever scanner is plugged
--      in (Cloud Storage scanner, third-party, manual). Tickets list
--      the scan status as a chip.

-- ─── 1. Ticket merge target ───────────────────────────────────────

ALTER TABLE "tickets"
  ADD COLUMN IF NOT EXISTS "merged_into_ticket_id" UUID
  REFERENCES "tickets"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "tickets_merged_into_idx"
  ON "tickets" ("merged_into_ticket_id");

-- ─── 2. Attachment download log ───────────────────────────────────

CREATE TABLE IF NOT EXISTS "attachment_download_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" UUID NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  -- Path or full URL of the asset that was fetched. We don't store the
  -- file bytes — that lives in storage — only the identifier.
  "attachment_url" VARCHAR(500) NOT NULL,
  -- Nullable: a public guest tracking link can still trigger a fetch,
  -- and we want that recorded with a null user.
  "downloaded_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "ip_address" VARCHAR(45),
  "user_agent" VARCHAR(500),
  "downloaded_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "attachment_download_events_ticket_idx"
  ON "attachment_download_events" ("ticket_id");

CREATE INDEX IF NOT EXISTS "attachment_download_events_downloaded_at_idx"
  ON "attachment_download_events" ("downloaded_at");

-- ─── 3. Attachment scan results ───────────────────────────────────

CREATE TABLE IF NOT EXISTS "ticket_attachment_scans" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticket_id" UUID NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "attachment_url" VARCHAR(500) NOT NULL,
  -- 'pending', 'clean', 'infected', 'error'. We don't CHECK this so
  -- bespoke scanners can record their own status codes if needed; the
  -- frontend maps anything outside this set to "unknown".
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Free-form scanner output for forensic review (signature name,
  -- error message, etc.). Capped low because we only need a summary.
  "details" VARCHAR(500),
  "scanner" VARCHAR(50),
  "scanned_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ticket_attachment_scans_ticket_idx"
  ON "ticket_attachment_scans" ("ticket_id");

CREATE UNIQUE INDEX IF NOT EXISTS "ticket_attachment_scans_ticket_url_uniq"
  ON "ticket_attachment_scans" ("ticket_id", "attachment_url");
