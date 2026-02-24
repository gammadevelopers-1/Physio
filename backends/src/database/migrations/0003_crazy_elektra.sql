CREATE TABLE "assessment_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"override_type" varchar(20) NOT NULL,
	"value" integer NOT NULL,
	"reason" text NOT NULL,
	"granted_by" uuid NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"performed_by" uuid NOT NULL,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"report_type" varchar(30) NOT NULL,
	"format" varchar(10) DEFAULT 'csv' NOT NULL,
	"course_id" uuid,
	"frequency" varchar(20) NOT NULL,
	"recipient_email" varchar(255),
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_reports_frequency_check" CHECK ("scheduled_reports"."frequency" IN ('daily', 'weekly', 'monthly')),
	CONSTRAINT "scheduled_reports_format_check" CHECK ("scheduled_reports"."format" IN ('csv', 'pdf', 'xlsx'))
);
--> statement-breakpoint
CREATE TABLE "course_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"review_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "course_ratings_course_student_unique" UNIQUE("course_id","student_id"),
	CONSTRAINT "course_ratings_rating_check" CHECK ("course_ratings"."rating" >= 1 AND "course_ratings"."rating" <= 5)
);
--> statement-breakpoint
ALTER TABLE "course_materials" DROP CONSTRAINT "course_materials_status_check";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_name_ar" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name_ar" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "department" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "specialty" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "instructor_status" varchar(20);--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "price" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "cme_hours" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "enrollment_deadline" timestamp;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "is_cme_accredited" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "language" varchar(10) DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "proctoring_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "proctoring_rules" jsonb;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "time_limit_enforced" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "max_retakes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "retake_cooling_hours" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "retake_score_policy" varchar(20) DEFAULT 'highest' NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "retake_scope" varchar(20) DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "flagged_at" timestamp;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "flagged_reason" text;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "flagged_by" uuid;--> statement-breakpoint
ALTER TABLE "course_materials" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "course_materials" ADD COLUMN "review_note" varchar(1000);--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "high_contrast" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "font_size" varchar(10) DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "reduce_motion" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "policy_enrollment_limit" integer DEFAULT 30;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "policy_require_content_review" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "policy_auto_approve_certificates" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "policy_cancellation_notice_hours" integer DEFAULT 24;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "policy_max_instructor_weekly_hours" integer DEFAULT 15;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "policy_enforce_nelc_compliance" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "assessment_overrides" ADD CONSTRAINT "assessment_overrides_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_overrides" ADD CONSTRAINT "assessment_overrides_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_overrides" ADD CONSTRAINT "assessment_overrides_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_ratings" ADD CONSTRAINT "course_ratings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_ratings" ADD CONSTRAINT "course_ratings_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessment_overrides_assessment_idx" ON "assessment_overrides" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "assessment_overrides_student_idx" ON "assessment_overrides" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_performed_by_idx" ON "audit_logs" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scheduled_reports_user_id_idx" ON "scheduled_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scheduled_reports_enabled_idx" ON "scheduled_reports" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "course_ratings_course_id_idx" ON "course_ratings" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_ratings_student_id_idx" ON "course_ratings" USING btree ("student_id");--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_flagged_by_users_id_fk" FOREIGN KEY ("flagged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_retake_scope_check" CHECK ("assessments"."retake_scope" IN ('full', 'failed_sections'));--> statement-breakpoint
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_status_check" CHECK ("course_materials"."status" IN ('processing', 'pending_review', 'live', 'failed', 'archived', 'changes_requested'));