-- Migration 0012: Dashboard Features (combined)
-- Features: Randomized exams, At-risk thresholds, Cohort, Video watch events, Session materials, Make-up assignment

-- Feature 2: Randomized exams
ALTER TABLE "assessments" ADD COLUMN "randomize_order" boolean NOT NULL DEFAULT false;
ALTER TABLE "assessments" ADD COLUMN "questions_per_attempt" integer;
ALTER TABLE "submissions" ADD COLUMN "question_order" jsonb;

-- Feature 3: At-risk thresholds
ALTER TABLE "courses" ADD COLUMN "at_risk_attendance_threshold" integer DEFAULT 70;
ALTER TABLE "courses" ADD COLUMN "at_risk_score_threshold" integer DEFAULT 60;
ALTER TABLE "courses" ADD COLUMN "at_risk_inactivity_days" integer DEFAULT 7;

-- Feature 4: Cohort
ALTER TABLE "courses" ADD COLUMN "cohort" varchar(100);
CREATE INDEX "courses_cohort_idx" ON "courses" ("cohort");

-- Feature 7: Video watch events
CREATE TABLE "video_watch_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "material_id" uuid NOT NULL REFERENCES "course_materials"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "event_type" varchar(20) NOT NULL,
  "position" integer NOT NULL,
  "from_position" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "video_watch_events_type_check" CHECK ("event_type" IN ('play','pause','seek','heartbeat','complete','buffer'))
);
CREATE INDEX "vwe_material_id_idx" ON "video_watch_events" ("material_id");
CREATE INDEX "vwe_student_id_idx" ON "video_watch_events" ("student_id");
CREATE INDEX "vwe_material_event_idx" ON "video_watch_events" ("material_id", "event_type");

-- Feature 8: Session materials
CREATE TABLE "session_materials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "material_id" uuid NOT NULL REFERENCES "course_materials"("id") ON DELETE CASCADE,
  "shared_by" uuid NOT NULL REFERENCES "users"("id"),
  "shared_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "sm_session_id_idx" ON "session_materials" ("session_id");
CREATE UNIQUE INDEX "sm_session_material_unique" ON "session_materials" ("session_id", "material_id");

-- Feature 9: Make-up session assignment
ALTER TABLE "sessions" ADD COLUMN "assigned_students" jsonb;
