CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"instructor_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" varchar(20) NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"zoom_link" varchar(500),
	"meeting_id" varchar(100),
	"room_name" varchar(255),
	"venue_address" text,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"actual_started_at" timestamp,
	"actual_ended_at" timestamp,
	"cancel_reason" text,
	"reminder_sent_at" timestamp,
	"zoom_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_type_check" CHECK ("sessions"."type" IN ('zoom', 'onsite', 'hybrid')),
	CONSTRAINT "sessions_status_check" CHECK ("sessions"."status" IN ('scheduled', 'live', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"last_accessed_at" timestamp,
	CONSTRAINT "enrollments_status_check" CHECK ("enrollments"."status" IN ('active', 'completed', 'dropped', 'suspended')),
	CONSTRAINT "enrollments_progress_check" CHECK ("enrollments"."progress" >= 0 AND "enrollments"."progress" <= 100)
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'absent' NOT NULL,
	"joined_at" timestamp,
	"left_at" timestamp,
	"duration_minutes" integer,
	"marked_by" uuid,
	"note" text,
	CONSTRAINT "attendance_status_check" CHECK ("attendance"."status" IN ('present', 'absent', 'late', 'excused'))
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"module_id" uuid,
	"title" varchar(255) NOT NULL,
	"type" varchar(20) NOT NULL,
	"total_marks" integer NOT NULL,
	"passing_marks" integer NOT NULL,
	"duration_minutes" integer,
	"attempts_allowed" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assessments_type_check" CHECK ("assessments"."type" IN ('quiz', 'exam', 'assignment')),
	CONSTRAINT "assessments_status_check" CHECK ("assessments"."status" IN ('draft', 'published', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid,
	"course_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"question_text" text NOT NULL,
	"question_text_ar" text,
	"options" jsonb,
	"correct_answer" text,
	"marks" integer DEFAULT 1 NOT NULL,
	"difficulty_level" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "questions_type_check" CHECK ("questions"."type" IN ('mcq', 'true_false', 'short_answer', 'essay')),
	CONSTRAINT "questions_difficulty_check" CHECK ("questions"."difficulty_level" IS NULL OR "questions"."difficulty_level" IN ('easy', 'medium', 'hard'))
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"answers" jsonb,
	"score" integer,
	"total_marks" integer,
	"percentage" numeric(5, 2),
	"started_at" timestamp,
	"submitted_at" timestamp,
	"status" varchar(20) DEFAULT 'in_progress' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "submissions_status_check" CHECK ("submissions"."status" IN ('in_progress', 'submitted', 'graded'))
);
--> statement-breakpoint
CREATE TABLE "course_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"module_id" uuid,
	"title" varchar(255) NOT NULL,
	"type" varchar(20) NOT NULL,
	"file_url" varchar(500),
	"file_size" bigint,
	"mime_type" varchar(100),
	"version" integer DEFAULT 1 NOT NULL,
	"previous_version_id" uuid,
	"order_index" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'processing' NOT NULL,
	"wcag_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"captions_url" varchar(500),
	"transcript_url" varchar(500),
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "course_materials_type_check" CHECK ("course_materials"."type" IN ('video', 'pdf', 'document', 'image')),
	CONSTRAINT "course_materials_status_check" CHECK ("course_materials"."status" IN ('processing', 'live', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "certificate_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attendance_percent" numeric(5, 2),
	"assessment_passed" boolean,
	"course_completed" boolean,
	"reviewed_by" uuid,
	"review_note" text,
	"reviewed_at" timestamp,
	"certificate_url" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "certificate_requests_status_check" CHECK ("certificate_requests"."status" IN ('pending', 'approved', 'rejected', 'held'))
);
--> statement-breakpoint
CREATE TABLE "interventions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"course_id" uuid,
	"type" varchar(30) NOT NULL,
	"message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nelc_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(60) NOT NULL,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" uuid,
	"user_id" uuid,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_assistants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'assistant' NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"assigned_by" uuid,
	"is_auto_assigned" boolean DEFAULT false NOT NULL,
	CONSTRAINT "session_assistants_role_check" CHECK ("session_assistants"."role" IN ('co_host', 'assistant'))
);
--> statement-breakpoint
CREATE TABLE "attendance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"student_id" uuid,
	"event_type" varchar(20) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"zoom_participant_id" varchar(100),
	"zoom_user_email" varchar(255),
	"raw_payload" jsonb
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "zoom_email" varchar(255);--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_module_id_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."course_modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_previous_version_fk" FOREIGN KEY ("previous_version_id") REFERENCES "public"."course_materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD CONSTRAINT "certificate_requests_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD CONSTRAINT "certificate_requests_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD CONSTRAINT "certificate_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nelc_audit_logs" ADD CONSTRAINT "nelc_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_assistants" ADD CONSTRAINT "session_assistants_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_assistants" ADD CONSTRAINT "session_assistants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_assistants" ADD CONSTRAINT "session_assistants_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_course_id_idx" ON "sessions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "sessions_instructor_id_idx" ON "sessions" USING btree ("instructor_id");--> statement-breakpoint
CREATE INDEX "sessions_scheduled_at_idx" ON "sessions" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "sessions_status_idx" ON "sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_course_student_unique" ON "enrollments" USING btree ("course_id","student_id");--> statement-breakpoint
CREATE INDEX "enrollments_course_id_idx" ON "enrollments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "enrollments_student_id_idx" ON "enrollments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "enrollments_status_idx" ON "enrollments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_session_student_unique" ON "attendance" USING btree ("session_id","student_id");--> statement-breakpoint
CREATE INDEX "attendance_session_id_idx" ON "attendance" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "attendance_student_id_idx" ON "attendance" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "assessments_course_id_idx" ON "assessments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "assessments_module_id_idx" ON "assessments" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "assessments_status_idx" ON "assessments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assessments_type_idx" ON "assessments" USING btree ("type");--> statement-breakpoint
CREATE INDEX "questions_assessment_id_idx" ON "questions" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "questions_course_id_idx" ON "questions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "questions_type_idx" ON "questions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "questions_difficulty_level_idx" ON "questions" USING btree ("difficulty_level");--> statement-breakpoint
CREATE INDEX "submissions_assessment_id_idx" ON "submissions" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "submissions_student_id_idx" ON "submissions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "submissions_status_idx" ON "submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "course_materials_course_id_idx" ON "course_materials" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_materials_module_id_idx" ON "course_materials" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "course_materials_type_idx" ON "course_materials" USING btree ("type");--> statement-breakpoint
CREATE INDEX "course_materials_status_idx" ON "course_materials" USING btree ("status");--> statement-breakpoint
CREATE INDEX "course_materials_uploaded_by_idx" ON "course_materials" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "course_materials_module_order_idx" ON "course_materials" USING btree ("module_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "certificate_requests_course_student_unique" ON "certificate_requests" USING btree ("course_id","student_id");--> statement-breakpoint
CREATE INDEX "certificate_requests_course_id_idx" ON "certificate_requests" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "certificate_requests_student_id_idx" ON "certificate_requests" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "certificate_requests_status_idx" ON "certificate_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "interventions_instructor_id_idx" ON "interventions" USING btree ("instructor_id");--> statement-breakpoint
CREATE INDEX "interventions_student_id_idx" ON "interventions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "interventions_course_id_idx" ON "interventions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "interventions_type_idx" ON "interventions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "nelc_audit_event_type_idx" ON "nelc_audit_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "nelc_audit_entity_idx" ON "nelc_audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "nelc_audit_user_id_idx" ON "nelc_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "nelc_audit_created_at_idx" ON "nelc_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "session_assistants_session_user_unique" ON "session_assistants" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "session_assistants_session_id_idx" ON "session_assistants" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_assistants_user_id_idx" ON "session_assistants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attendance_logs_session_id_idx" ON "attendance_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "attendance_logs_student_id_idx" ON "attendance_logs" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "attendance_logs_session_student_idx" ON "attendance_logs" USING btree ("session_id","student_id");