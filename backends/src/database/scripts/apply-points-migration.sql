-- ============================================================================
-- Points System — idempotent migration for production
-- ============================================================================
-- Applies the 5 points tables introduced in docs/points-system-plan.md.
--
-- Apply with:
--   DATABASE_URL=<prod-url> node src/database/scripts/apply-single-migration.cjs \
--     src/database/scripts/apply-points-migration.sql
--
-- Idempotent: re-running is a no-op (uses IF NOT EXISTS / ON CONFLICT).
-- Safe to apply before or after deploying the new backend code.
-- ============================================================================

-- ─── 1. point_rules ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "point_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "rule_key" varchar(50) NOT NULL,
  "points_amount" integer NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "max_per_user" integer,
  "cooldown_seconds" integer,
  "description" text,
  "description_ar" text,
  "expires_after_days" integer,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "point_rules_rule_key_unique" UNIQUE ("rule_key"),
  CONSTRAINT "point_rules_amount_non_negative" CHECK ("points_amount" >= 0)
);

DO $$ BEGIN
  ALTER TABLE "point_rules" ADD CONSTRAINT "point_rules_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "point_rules_active_idx" ON "point_rules" ("is_active");

-- ─── 2. point_transactions (the ledger) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "point_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "delta" integer NOT NULL,
  "reason" varchar(50) NOT NULL,
  "rule_id" uuid,
  "source_entity_type" varchar(50),
  "source_entity_id" uuid,
  "idempotency_key" varchar(120),
  "expires_at" timestamp,
  "metadata" jsonb,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "point_transactions_idempotency_key_unique" UNIQUE ("idempotency_key")
);

DO $$ BEGIN
  ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_rule_id_point_rules_id_fk"
    FOREIGN KEY ("rule_id") REFERENCES "point_rules"("id") ON DELETE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "point_transactions_user_id_idx" ON "point_transactions" ("user_id");
CREATE INDEX IF NOT EXISTS "point_transactions_user_created_idx" ON "point_transactions" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "point_transactions_expires_at_idx" ON "point_transactions" ("expires_at");
CREATE INDEX IF NOT EXISTS "point_transactions_rule_id_idx" ON "point_transactions" ("rule_id");
CREATE INDEX IF NOT EXISTS "point_transactions_source_idx" ON "point_transactions" ("source_entity_type", "source_entity_id");

-- ─── 3. point_redemptions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "point_redemptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "course_id" uuid,
  "points_used" integer NOT NULL,
  "discount_amount_sar" numeric(10, 2) NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "enrollment_id" uuid,
  "expires_at" timestamp NOT NULL,
  "applied_at" timestamp,
  "released_at" timestamp,
  "reversed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "point_redemptions_status_check" CHECK ("status" IN ('pending', 'applied', 'released', 'reversed')),
  CONSTRAINT "point_redemptions_points_positive" CHECK ("points_used" > 0)
);

DO $$ BEGIN
  ALTER TABLE "point_redemptions" ADD CONSTRAINT "point_redemptions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "point_redemptions" ADD CONSTRAINT "point_redemptions_course_id_courses_id_fk"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "point_redemptions" ADD CONSTRAINT "point_redemptions_enrollment_id_enrollments_id_fk"
    FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "point_redemptions_user_id_idx" ON "point_redemptions" ("user_id");
CREATE INDEX IF NOT EXISTS "point_redemptions_status_idx" ON "point_redemptions" ("status");
CREATE INDEX IF NOT EXISTS "point_redemptions_expires_at_idx" ON "point_redemptions" ("expires_at");

-- ─── 4. points_config (singleton) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "points_config" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "conversion_rate_points_per_sar" integer DEFAULT 10 NOT NULL,
  "min_redemption_points" integer DEFAULT 100 NOT NULL,
  "max_redemption_pct" integer DEFAULT 50 NOT NULL,
  "combinable_with_coupons" boolean DEFAULT false NOT NULL,
  "default_expiration_days" integer,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "updated_by" uuid,
  CONSTRAINT "points_config_singleton" CHECK ("id" = 1),
  CONSTRAINT "points_config_max_redemption_pct_range" CHECK ("max_redemption_pct" >= 0 AND "max_redemption_pct" <= 100),
  CONSTRAINT "points_config_conversion_positive" CHECK ("conversion_rate_points_per_sar" > 0)
);

DO $$ BEGIN
  ALTER TABLE "points_config" ADD CONSTRAINT "points_config_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 5. course_redemption_settings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "course_redemption_settings" (
  "course_id" uuid PRIMARY KEY,
  "redeemable_for_free" boolean DEFAULT false NOT NULL,
  "free_unlock_cost_points" integer,
  "max_redemption_pct" integer,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "course_redemption_max_pct_range" CHECK ("max_redemption_pct" IS NULL OR ("max_redemption_pct" >= 0 AND "max_redemption_pct" <= 100)),
  CONSTRAINT "course_redemption_cost_positive" CHECK ("free_unlock_cost_points" IS NULL OR "free_unlock_cost_points" > 0)
);

DO $$ BEGIN
  ALTER TABLE "course_redemption_settings" ADD CONSTRAINT "course_redemption_settings_course_id_courses_id_fk"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Seed: default rules + singleton config ─────────────────────────────────
INSERT INTO "point_rules" (rule_key, points_amount, max_per_user, description, description_ar, expires_after_days)
VALUES
  ('signup', 50, 1, 'Welcome bonus for new student signup', 'مكافأة ترحيبية للطلاب الجدد', 365),
  ('course_completed', 200, NULL, 'Reward for completing an enrolled course', 'مكافأة إكمال دورة مسجّل بها', 365),
  ('review_approved', 25, NULL, 'Reward when your course review is approved by a manager', 'مكافأة عند الموافقة على مراجعتك للدورة', 365)
ON CONFLICT (rule_key) DO NOTHING;

INSERT INTO "points_config" (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
