-- ===================================================================
-- Instructor Ratings table — idempotent
-- Creates instructor_ratings, parallel to course_ratings.
-- Safe to run multiple times.
-- ===================================================================

CREATE TABLE IF NOT EXISTS instructor_ratings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         UUID NOT NULL,
  instructor_id     UUID NOT NULL,
  student_id        UUID NOT NULL,
  rating            INTEGER NOT NULL,
  review_text       TEXT,
  moderation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  is_published      BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by       UUID,
  reviewed_at       TIMESTAMP,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT instructor_ratings_rating_check
    CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT instructor_ratings_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved', 'rejected'))
);

-- FKs (separate so re-runs survive partial creation)
DO $$ BEGIN
  ALTER TABLE instructor_ratings
    ADD CONSTRAINT instructor_ratings_course_id_fkey
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE instructor_ratings
    ADD CONSTRAINT instructor_ratings_instructor_id_fkey
    FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE instructor_ratings
    ADD CONSTRAINT instructor_ratings_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE instructor_ratings
    ADD CONSTRAINT instructor_ratings_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Unique: one instructor review per (course, student) pair
DO $$ BEGIN
  ALTER TABLE instructor_ratings
    ADD CONSTRAINT instructor_ratings_course_student_unique
    UNIQUE (course_id, student_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS instructor_ratings_course_id_idx
  ON instructor_ratings (course_id);
CREATE INDEX IF NOT EXISTS instructor_ratings_instructor_id_idx
  ON instructor_ratings (instructor_id);
CREATE INDEX IF NOT EXISTS instructor_ratings_student_id_idx
  ON instructor_ratings (student_id);
CREATE INDEX IF NOT EXISTS instructor_ratings_moderation_idx
  ON instructor_ratings (moderation_status);
CREATE INDEX IF NOT EXISTS instructor_ratings_published_idx
  ON instructor_ratings (is_published);
