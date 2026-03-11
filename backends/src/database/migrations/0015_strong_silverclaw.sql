CREATE TABLE "course_assistants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'approved' NOT NULL,
	"suggested_by" uuid,
	"approved_by" uuid,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	CONSTRAINT "course_assistants_status_check" CHECK ("course_assistants"."status" IN ('suggested', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "video_watch_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"event_type" varchar(20) NOT NULL,
	"position" integer NOT NULL,
	"from_position" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "video_watch_events_type_check" CHECK ("video_watch_events"."event_type" IN ('play','pause','seek','heartbeat','complete','buffer'))
);
--> statement-breakpoint
CREATE TABLE "session_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"shared_by" uuid NOT NULL,
	"shared_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" DROP CONSTRAINT "courses_status_check";--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_status_check";--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "at_risk_attendance_threshold" integer DEFAULT 70;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "at_risk_score_threshold" integer DEFAULT 60;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "at_risk_inactivity_days" integer DEFAULT 7;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "cohort" varchar(100);--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "review_note" varchar(1000);--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "assigned_students" jsonb;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "assignment_files" jsonb;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "randomize_order" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "questions_per_attempt" integer;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "submission_files" jsonb;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "question_order" jsonb;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "instructor_comment" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "question_comments" jsonb;--> statement-breakpoint
ALTER TABLE "course_materials" ADD COLUMN "auto_transcribe" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "course_assistants" ADD CONSTRAINT "course_assistants_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_assistants" ADD CONSTRAINT "course_assistants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_assistants" ADD CONSTRAINT "course_assistants_suggested_by_users_id_fk" FOREIGN KEY ("suggested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_assistants" ADD CONSTRAINT "course_assistants_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_watch_events" ADD CONSTRAINT "video_watch_events_material_id_course_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."course_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_watch_events" ADD CONSTRAINT "video_watch_events_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_materials" ADD CONSTRAINT "session_materials_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_materials" ADD CONSTRAINT "session_materials_material_id_course_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."course_materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_materials" ADD CONSTRAINT "session_materials_shared_by_users_id_fk" FOREIGN KEY ("shared_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_assistants_course_user_unique" ON "course_assistants" USING btree ("course_id","user_id");--> statement-breakpoint
CREATE INDEX "course_assistants_course_id_idx" ON "course_assistants" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_assistants_user_id_idx" ON "course_assistants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vwe_material_id_idx" ON "video_watch_events" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "vwe_student_id_idx" ON "video_watch_events" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "vwe_material_event_idx" ON "video_watch_events" USING btree ("material_id","event_type");--> statement-breakpoint
CREATE INDEX "sm_session_id_idx" ON "session_materials" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sm_session_material_unique" ON "session_materials" USING btree ("session_id","material_id");--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_status_check" CHECK ("courses"."status" IN ('draft', 'pending_review', 'changes_requested', 'active', 'completed', 'archived'));--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_status_check" CHECK ("sessions"."status" IN ('scheduled', 'live', 'ended', 'completed', 'cancelled'));