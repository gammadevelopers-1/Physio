-- Migration 0059: Macros extensions — bilingual body, category link,
-- system-owned macros, usage tracking.
--
-- Five changes that turn the macros library from a flat English-only
-- list into a categorised bilingual template store with analytics:
--
--   1) support_macros.body_ar — Arabic body. Optional; falls back to
--      body_template (English) when not provided. Server picks which
--      to substitute based on the request locale at apply time.
--
--   2) support_macros.category_key — slug linking a macro to a ticket
--      category (e.g. 'login', 'billing', 'webinar'). NULL means the
--      macro is general-purpose and shows in every ticket's dropdown.
--      Free-form varchar — categories live in support_config, not an
--      enum, so we don't add a CHECK constraint.
--
--   3) support_macros.created_by — now nullable + ON DELETE SET NULL.
--      Lets the system seed starter macros (created_by = NULL) and
--      preserves the macro library when a former agent's account is
--      deleted (previous behaviour was CASCADE — would silently wipe
--      every macro that staffer authored).
--
--   4) support_macro_uses — one row per macro apply, for analytics
--      (which macros agents actually use, who relies on macro X,
--      monthly trend). Same shape and rationale as kb_search_events.
--      Hot path: aggregation queries scan by macro_id + applied_at.
--
--   5) Helper indexes — category_key (dropdown filter), is_active
--      (management list scan), and the use-table aggregates.
--
-- No data backfill needed. New columns default to NULL → existing
-- macros stay English-only, uncategorised, and authored by the staff
-- member who created them.

ALTER TABLE "support_macros"
  ADD COLUMN IF NOT EXISTS "body_ar" TEXT;

ALTER TABLE "support_macros"
  ADD COLUMN IF NOT EXISTS "category_key" VARCHAR(50);

-- Drop the existing FK + NOT NULL on created_by so we can re-add as
-- nullable with SET NULL semantics. Name comes from Drizzle's
-- auto-generated <table>_<column>_<refTable>_<refColumn>_fk pattern.
ALTER TABLE "support_macros"
  DROP CONSTRAINT IF EXISTS "support_macros_created_by_users_id_fk";

ALTER TABLE "support_macros"
  ALTER COLUMN "created_by" DROP NOT NULL;

ALTER TABLE "support_macros"
  ADD CONSTRAINT "support_macros_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "support_macros_category_key_idx"
  ON "support_macros" ("category_key")
  WHERE "category_key" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "support_macros_is_active_idx"
  ON "support_macros" ("is_active");

CREATE TABLE IF NOT EXISTS "support_macro_uses" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "macro_id" UUID NOT NULL REFERENCES "support_macros"("id") ON DELETE CASCADE,
  "ticket_id" UUID NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "applied_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "support_macro_uses_macro_id_idx"
  ON "support_macro_uses" ("macro_id");

CREATE INDEX IF NOT EXISTS "support_macro_uses_user_id_idx"
  ON "support_macro_uses" ("user_id");

CREATE INDEX IF NOT EXISTS "support_macro_uses_applied_at_idx"
  ON "support_macro_uses" ("applied_at");
