-- Migration 0051: Custom ticket tags
--
-- Two-table design. The registry (`ticket_tags`) is admin-curated so the
-- taxonomy doesn't drift the way free-text would. The junction
-- (`ticket_tag_assignments`) carries the relationship plus a small bit
-- of provenance (who attached it, when) so reports can credit tagging
-- work without joining against the staff-action log later.

CREATE TABLE IF NOT EXISTS "ticket_tags" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Display name shown on chips and used in the API. Stored
  -- case-preserving but the unique index below is case-insensitive so
  -- "Refund" and "refund" can't both exist.
  "name" VARCHAR(50) NOT NULL,
  -- Hex (#RRGGBB) for the chip background. Frontend picks a contrasting
  -- text color at render time, so we only store the one value.
  "color" VARCHAR(9) NOT NULL DEFAULT '#E5E7EB',
  -- Optional short description shown in the admin manager.
  "description" VARCHAR(200),
  "created_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness — see the comment on `name` above.
CREATE UNIQUE INDEX IF NOT EXISTS "ticket_tags_name_lower_idx"
  ON "ticket_tags" (LOWER("name"));

-- Junction table. Composite PK rather than a synthetic id because
-- (ticket, tag) is the natural key and we never need to address a
-- single assignment row from outside.
CREATE TABLE IF NOT EXISTS "ticket_tag_assignments" (
  "ticket_id" UUID NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "tag_id" UUID NOT NULL REFERENCES "ticket_tags"("id") ON DELETE CASCADE,
  "assigned_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "assigned_at" TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY ("ticket_id", "tag_id")
);

-- Hot-path index for the inverse lookup ("which tickets carry tag X")
-- used by the All Tickets filter chip.
CREATE INDEX IF NOT EXISTS "ticket_tag_assignments_tag_idx"
  ON "ticket_tag_assignments" ("tag_id");
