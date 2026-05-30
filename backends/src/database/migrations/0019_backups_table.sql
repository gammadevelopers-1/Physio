-- Hand-written, idempotent migration for the admin backups feature.
--
-- NOTE: drizzle-kit's auto-generated diff for this step was a kitchen-sink
-- (the journal is stale at 0017, so it re-emitted CREATE TABLE for tables
-- that already exist in prod). This file is the surgical, idempotent
-- equivalent — only the `backups` table — applied via
-- src/database/scripts/apply-single-migration.cjs.

CREATE TABLE IF NOT EXISTS "backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(20) DEFAULT 'database' NOT NULL,
	"mode" varchar(20) DEFAULT 'export' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"gcs_bucket" varchar(120),
	"gcs_object" varchar(500),
	"file_size_bytes" bigint,
	"operation_name" varchar(200),
	"error" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);

DO $$ BEGIN
	ALTER TABLE "backups" ADD CONSTRAINT "backups_created_by_users_id_fk"
		FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
		ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "backups_status_idx" ON "backups" USING btree ("status");
CREATE INDEX IF NOT EXISTS "backups_created_at_idx" ON "backups" USING btree ("created_at");
