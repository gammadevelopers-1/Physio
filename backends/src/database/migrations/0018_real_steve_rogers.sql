CREATE TABLE "email_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"purpose" varchar(50) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"ip_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_retake_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"granted_by" uuid NOT NULL,
	"reason" text,
	"new_due_date" timestamp,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	CONSTRAINT "point_rules_rule_key_unique" UNIQUE("rule_key"),
	CONSTRAINT "point_rules_amount_non_negative" CHECK ("point_rules"."points_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "point_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	CONSTRAINT "point_transactions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "point_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	CONSTRAINT "point_redemptions_status_check" CHECK ("point_redemptions"."status" IN ('pending', 'applied', 'released', 'reversed')),
	CONSTRAINT "point_redemptions_points_positive" CHECK ("point_redemptions"."points_used" > 0)
);
--> statement-breakpoint
CREATE TABLE "points_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"conversion_rate_points_per_sar" integer DEFAULT 10 NOT NULL,
	"min_redemption_points" integer DEFAULT 100 NOT NULL,
	"max_redemption_pct" integer DEFAULT 50 NOT NULL,
	"combinable_with_coupons" boolean DEFAULT false NOT NULL,
	"default_expiration_days" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "points_config_singleton" CHECK ("points_config"."id" = 1),
	CONSTRAINT "points_config_max_redemption_pct_range" CHECK ("points_config"."max_redemption_pct" >= 0 AND "points_config"."max_redemption_pct" <= 100),
	CONSTRAINT "points_config_conversion_positive" CHECK ("points_config"."conversion_rate_points_per_sar" > 0)
);
--> statement-breakpoint
CREATE TABLE "course_redemption_settings" (
	"course_id" uuid PRIMARY KEY NOT NULL,
	"redeemable_for_free" boolean DEFAULT false NOT NULL,
	"free_unlock_cost_points" integer,
	"max_redemption_pct" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "course_redemption_max_pct_range" CHECK ("course_redemption_settings"."max_redemption_pct" IS NULL OR ("course_redemption_settings"."max_redemption_pct" >= 0 AND "course_redemption_settings"."max_redemption_pct" <= 100)),
	CONSTRAINT "course_redemption_cost_positive" CHECK ("course_redemption_settings"."free_unlock_cost_points" IS NULL OR "course_redemption_settings"."free_unlock_cost_points" > 0)
);
--> statement-breakpoint
ALTER TABLE "courses" DROP CONSTRAINT "courses_delivery_type_check";--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_status_check";--> statement-breakpoint
ALTER TABLE "role_requests" ADD COLUMN "structured_resume" jsonb;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "overview" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "overview_ar" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "objectives" jsonb;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "objectives_ar" jsonb;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "features" jsonb;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "features_ar" jsonb;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "target_audience" jsonb;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "target_audience_ar" jsonb;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "requirements" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "requirements_ar" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "notices" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "notices_ar" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "venue" varchar(255);--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "venue_ar" varchar(255);--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "show_contents" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "sections_order" jsonb;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "visible_on_public_site" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "assessment_proctoring_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "assessment_time_limit_enforced" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "assessment_max_retakes" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "assessment_retake_cooling_hours" integer DEFAULT 24;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "assessment_retake_score_policy" varchar(20) DEFAULT 'highest';--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "assessment_retake_scope" varchar(20) DEFAULT 'full';--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "reschedule_reason" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "rescheduled_to_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "auto_end_warning_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "course_assistants" ADD COLUMN "rejection_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "course_assistants" ADD COLUMN "rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "course_ratings" ADD COLUMN "moderation_status" varchar(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "course_ratings" ADD COLUMN "is_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "course_ratings" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "course_ratings" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "assessment_retake_grants" ADD CONSTRAINT "assessment_retake_grants_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_retake_grants" ADD CONSTRAINT "assessment_retake_grants_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_retake_grants" ADD CONSTRAINT "assessment_retake_grants_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_rules" ADD CONSTRAINT "point_rules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_rule_id_point_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."point_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_redemptions" ADD CONSTRAINT "point_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_redemptions" ADD CONSTRAINT "point_redemptions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_redemptions" ADD CONSTRAINT "point_redemptions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_config" ADD CONSTRAINT "points_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_redemption_settings" ADD CONSTRAINT "course_redemption_settings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_verifications_email_purpose_idx" ON "email_verifications" USING btree ("email","purpose","is_used");--> statement-breakpoint
CREATE INDEX "email_verifications_created_at_idx" ON "email_verifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "assessment_retake_grants_assessment_idx" ON "assessment_retake_grants" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "assessment_retake_grants_student_idx" ON "assessment_retake_grants" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "assessment_retake_grants_unused_idx" ON "assessment_retake_grants" USING btree ("assessment_id","student_id","used_at");--> statement-breakpoint
CREATE INDEX "point_rules_active_idx" ON "point_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "point_transactions_user_id_idx" ON "point_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "point_transactions_user_created_idx" ON "point_transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "point_transactions_expires_at_idx" ON "point_transactions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "point_transactions_rule_id_idx" ON "point_transactions" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "point_transactions_source_idx" ON "point_transactions" USING btree ("source_entity_type","source_entity_id");--> statement-breakpoint
CREATE INDEX "point_redemptions_user_id_idx" ON "point_redemptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "point_redemptions_status_idx" ON "point_redemptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "point_redemptions_expires_at_idx" ON "point_redemptions" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "course_ratings" ADD CONSTRAINT "course_ratings_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "courses_manager_id_idx" ON "courses" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "course_ratings_moderation_idx" ON "course_ratings" USING btree ("moderation_status");--> statement-breakpoint
CREATE INDEX "course_ratings_published_idx" ON "course_ratings" USING btree ("is_published");--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_delivery_type_check" CHECK ("courses"."delivery_type" IN ('zoom', 'onsite', 'blended', 'self-paced'));--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_status_check" CHECK ("sessions"."status" IN ('scheduled', 'live', 'ended', 'completed', 'cancelled', 'missed', 'rescheduled'));--> statement-breakpoint
ALTER TABLE "course_ratings" ADD CONSTRAINT "course_ratings_moderation_status_check" CHECK ("course_ratings"."moderation_status" IN ('pending', 'approved', 'rejected'));