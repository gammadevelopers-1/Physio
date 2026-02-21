CREATE TABLE "material_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"resolution" varchar(10) NOT NULL,
	"file_url" varchar(500) NOT NULL,
	"file_size" bigint,
	"width" bigint,
	"height" bigint,
	"bitrate" varchar(20),
	"mime_type" varchar(100) DEFAULT 'video/mp4' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_new_student" boolean DEFAULT true,
	"email_course_complete" boolean DEFAULT true,
	"email_assessment_submit" boolean DEFAULT false,
	"email_certificate_request" boolean DEFAULT true,
	"push_new_session" boolean DEFAULT true,
	"push_student_message" boolean DEFAULT true,
	"push_system_updates" boolean DEFAULT false,
	"digest_weekly" boolean DEFAULT true,
	"digest_monthly" boolean DEFAULT false,
	"theme" varchar(20) DEFAULT 'light',
	"date_format" varchar(20) DEFAULT 'MM/DD/YYYY',
	"time_format" varchar(10) DEFAULT '12h',
	"timezone" varchar(50) DEFAULT 'UTC',
	"default_view" varchar(30) DEFAULT 'dashboard',
	"compact_mode" boolean DEFAULT false,
	"show_tips" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" varchar(1000);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location" varchar(200);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "language" varchar(10) DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "course_materials" ADD COLUMN "processing_step" varchar(30);--> statement-breakpoint
ALTER TABLE "course_materials" ADD COLUMN "processing_error" varchar(1000);--> statement-breakpoint
ALTER TABLE "material_variants" ADD CONSTRAINT "material_variants_material_id_course_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."course_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_variants_material_id_idx" ON "material_variants" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "material_variants_resolution_idx" ON "material_variants" USING btree ("material_id","resolution");