-- Migration 0050: Human-readable ticket reference numbers (T-000123)
--
-- Replaces the practice of slicing the UUID with a stable, scannable,
-- monotonically-increasing reference that is safe to read aloud and
-- search for. The actual UUID stays the primary key — this column is
-- only used for display, search, and email subjects.

-- 1) Sequence backing the reference. Starting at 1; the backfill below
--    bumps it past the row count so new tickets pick up the next free
--    number.
CREATE SEQUENCE IF NOT EXISTS tickets_reference_seq START WITH 1;

-- 2) Add the column nullable so we can backfill in-order before locking
--    it down with NOT NULL + UNIQUE.
ALTER TABLE "tickets"
  ADD COLUMN IF NOT EXISTS "reference_number" VARCHAR(20);

-- 3) Backfill existing tickets in created_at order so the lowest number
--    belongs to the oldest ticket. Without the row_number() window the
--    update would assign sequence values in physical-row order, which
--    is non-deterministic.
WITH ordered AS (
  SELECT
    "id",
    'T-' || LPAD(
      (row_number() OVER (ORDER BY "created_at" ASC))::text,
      6,
      '0'
    ) AS ref
  FROM "tickets"
  WHERE "reference_number" IS NULL
)
UPDATE "tickets" t
SET "reference_number" = ordered.ref
FROM ordered
WHERE t."id" = ordered."id";

-- 4) Advance the sequence past whatever was just backfilled so the next
--    insert picks up a fresh value. setval(..., n, true) means "the
--    next nextval() returns n+1".
SELECT setval(
  'tickets_reference_seq',
  GREATEST((SELECT COUNT(*) FROM "tickets"), 1),
  true
);

-- 5) Lock the column down.
ALTER TABLE "tickets" ALTER COLUMN "reference_number" SET NOT NULL;
ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_reference_number_unique"
  UNIQUE ("reference_number");

-- 6) Default for new rows — same shape as the backfill.
ALTER TABLE "tickets"
  ALTER COLUMN "reference_number"
  SET DEFAULT 'T-' || LPAD(nextval('tickets_reference_seq')::text, 6, '0');

-- 7) Index for fuzzy lookup by ref (LIKE 'T-000%').
CREATE INDEX IF NOT EXISTS "tickets_reference_number_idx"
  ON "tickets" ("reference_number");
