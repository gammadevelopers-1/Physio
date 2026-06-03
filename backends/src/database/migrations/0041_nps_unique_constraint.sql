-- Migration: Add unique constraint on NPS surveys (userId + courseId)
-- Prevents duplicate NPS surveys for same user + course combination

CREATE UNIQUE INDEX IF NOT EXISTS "nps_surveys_user_course_unique"
  ON "nps_surveys" ("user_id", "course_id")
  WHERE "course_id" IS NOT NULL;
