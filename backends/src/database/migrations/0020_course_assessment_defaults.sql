-- Course-level assessment defaults (per-assessment can override)
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "assessment_proctoring_enabled" boolean DEFAULT false;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "assessment_time_limit_enforced" boolean DEFAULT true;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "assessment_max_retakes" integer DEFAULT 0;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "assessment_retake_cooling_hours" integer DEFAULT 24;
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "assessment_retake_score_policy" varchar(20) DEFAULT 'highest';
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "assessment_retake_scope" varchar(20) DEFAULT 'full';
