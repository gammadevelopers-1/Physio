-- Migration: 0045_tickets_hot_path_indexes
-- Purpose: Add B-tree indexes on three high-traffic ticket query paths
-- that currently table-scan in production:
--   - guest_email     → guest ticket tracker lookup + email-based dedup
--   - first_response_at → SLA dashboards filter "responded vs not"
--   - resolved_at     → CSAT survey scheduler + resolution-time reports
--
-- All three are `IF NOT EXISTS` so this migration is idempotent across
-- environments that may have been hand-indexed.

CREATE INDEX IF NOT EXISTS "tickets_guest_email_idx"
  ON "tickets" ("guest_email")
  WHERE "guest_email" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "tickets_first_response_at_idx"
  ON "tickets" ("first_response_at");

CREATE INDEX IF NOT EXISTS "tickets_resolved_at_idx"
  ON "tickets" ("resolved_at");
