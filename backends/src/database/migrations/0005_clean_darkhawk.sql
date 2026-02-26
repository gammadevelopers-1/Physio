CREATE TABLE "material_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"module_id" uuid,
	"watched_seconds" integer DEFAULT 0 NOT NULL,
	"total_seconds" integer DEFAULT 0 NOT NULL,
	"furthest_watched_second" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"message" text NOT NULL,
	"is_staff_reply" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"category" varchar(30) NOT NULL,
	"priority" varchar(10) DEFAULT 'medium' NOT NULL,
	"subject" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"attachment_url" varchar(500),
	"course_id" uuid,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"assignee_id" uuid,
	"satisfaction_rating" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"closed_at" timestamp,
	CONSTRAINT "tickets_status_check" CHECK ("tickets"."status" IN ('new', 'in_progress', 'resolved', 'closed')),
	CONSTRAINT "tickets_category_check" CHECK ("tickets"."category" IN ('billing', 'login', 'content', 'certificate', 'technical', 'other')),
	CONSTRAINT "tickets_priority_check" CHECK ("tickets"."priority" IN ('high', 'medium', 'low')),
	CONSTRAINT "tickets_rating_check" CHECK ("tickets"."satisfaction_rating" IS NULL OR ("tickets"."satisfaction_rating" >= 1 AND "tickets"."satisfaction_rating" <= 5))
);
--> statement-breakpoint
CREATE TABLE "waitlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'waiting' NOT NULL,
	"position" integer NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"notified_at" timestamp,
	"expires_at" timestamp,
	CONSTRAINT "waitlists_status_check" CHECK ("waitlists"."status" IN ('waiting', 'notified', 'enrolled', 'expired', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_type_check";--> statement-breakpoint
ALTER TABLE "certificate_requests" DROP CONSTRAINT "certificate_requests_status_check";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "scfhs_number" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "national_id" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nationality" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "date_of_birth" varchar(10);--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "instructions" varchar(5000);--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "due_date" timestamp;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "content_language" varchar(10) DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "calendar_format" varchar(15) DEFAULT 'gregorian';--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "captions_default" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "subtitles_language" varchar(10) DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "reminder_minutes" integer DEFAULT 30;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "profile_visibility" varchar(20) DEFAULT 'full';--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "data_sharing" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "material_progress" ADD CONSTRAINT "material_progress_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_progress" ADD CONSTRAINT "material_progress_material_id_course_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."course_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_progress" ADD CONSTRAINT "material_progress_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_progress" ADD CONSTRAINT "material_progress_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlists" ADD CONSTRAINT "waitlists_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlists" ADD CONSTRAINT "waitlists_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "material_progress_student_material_unique" ON "material_progress" USING btree ("student_id","material_id");--> statement-breakpoint
CREATE INDEX "material_progress_student_id_idx" ON "material_progress" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "material_progress_course_id_idx" ON "material_progress" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "ticket_replies_ticket_id_idx" ON "ticket_replies" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_replies_user_id_idx" ON "ticket_replies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tickets_student_id_idx" ON "tickets" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tickets_category_idx" ON "tickets" USING btree ("category");--> statement-breakpoint
CREATE INDEX "tickets_assignee_id_idx" ON "tickets" USING btree ("assignee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlists_course_student_unique" ON "waitlists" USING btree ("course_id","student_id");--> statement-breakpoint
CREATE INDEX "waitlists_course_id_idx" ON "waitlists" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "waitlists_student_id_idx" ON "waitlists" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "waitlists_status_idx" ON "waitlists" USING btree ("status");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_type_check" CHECK ("questions"."type" IN ('mcq', 'true_false', 'short_answer', 'essay', 'file_upload'));--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD CONSTRAINT "certificate_requests_status_check" CHECK ("certificate_requests"."status" IN ('pending', 'approved', 'rejected', 'held', 'revoked'));