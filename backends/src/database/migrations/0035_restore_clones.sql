-- 0035_restore_clones.sql
--
-- Tracking table for the admin restore-sandbox feature (Phase 2D).
-- Each row corresponds to one ephemeral Postgres database created on
-- the live Cloud SQL instance, restored from a backup export. The
-- sandbox is a read-only workspace for the admin to extract specific
-- rows via Cloud SQL Studio / psql; a cron drops it past expires_at.
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS "restore_clones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "backup_id" uuid,
  "db_name" varchar(120) NOT NULL,
  "status" varchar(20) DEFAULT 'creating' NOT NULL,
  "sql_operation_name" varchar(200),
  "error" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL,
  "dropped_at" timestamp,
  "dropped_by" uuid
);

DO $$ BEGIN
  ALTER TABLE "restore_clones"
    ADD CONSTRAINT "restore_clones_backup_id_backups_id_fk"
    FOREIGN KEY ("backup_id") REFERENCES "public"."backups"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "restore_clones"
    ADD CONSTRAINT "restore_clones_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "restore_clones"
    ADD CONSTRAINT "restore_clones_dropped_by_users_id_fk"
    FOREIGN KEY ("dropped_by") REFERENCES "public"."users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "restore_clones_status_idx"
  ON "restore_clones" USING btree ("status");
CREATE INDEX IF NOT EXISTS "restore_clones_expires_at_idx"
  ON "restore_clones" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "restore_clones_created_by_idx"
  ON "restore_clones" USING btree ("created_by");
