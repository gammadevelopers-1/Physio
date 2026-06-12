-- Migration 0058: Tag lifecycle — archive + auto-apply rules
--
-- Two changes that turn tags from a flat label list into a managed
-- taxonomy:
--
--   1) ticket_tags.archived_at — soft archive. Hides a tag from the
--      picker / auto-apply matcher / new assignments without losing
--      existing history. Filterable in list view either way.
--
--   2) ticket_tag_rules — per-tag keyword rules. When a ticket is
--      created (or has its subject/description updated), every enabled
--      rule whose pattern appears in the chosen scope automatically
--      attaches its tag. `assigned_by IS NULL` on the resulting
--      junction row is the system-actor signal.
--
-- No data backfill needed. Archive column is NULL for every existing
-- row → all tags remain active.

ALTER TABLE "ticket_tags"
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP;

CREATE INDEX IF NOT EXISTS "ticket_tags_archived_at_idx"
  ON "ticket_tags" ("archived_at")
  WHERE "archived_at" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "ticket_tag_rules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tag_id" UUID NOT NULL REFERENCES "ticket_tags"("id") ON DELETE CASCADE,
  "pattern" VARCHAR(200) NOT NULL,
  "match_scope" VARCHAR(20) NOT NULL DEFAULT 'both',
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT "tag_rule_scope_check"
    CHECK ("match_scope" IN ('subject', 'description', 'both')),
  CONSTRAINT "tag_rule_pattern_not_blank"
    CHECK (length(trim("pattern")) > 0)
);

-- Hot path: the rule engine fetches enabled rules grouped by tag on
-- every ticket create. Partial index keeps the lookup tight when most
-- rules are enabled (the common case).
CREATE INDEX IF NOT EXISTS "ticket_tag_rules_enabled_idx"
  ON "ticket_tag_rules" ("tag_id")
  WHERE "enabled" = TRUE;
