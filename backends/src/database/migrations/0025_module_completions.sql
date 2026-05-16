-- Per-student per-module completion records.
--
-- Replaces the brittle "reverse-derive completion from progress percentage"
-- approach. UNIQUE (student_id, module_id) makes repeated Mark Complete
-- clicks idempotent.

CREATE TABLE IF NOT EXISTS module_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  completed_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS module_completions_student_module_unique
  ON module_completions(student_id, module_id);

CREATE INDEX IF NOT EXISTS module_completions_student_course_idx
  ON module_completions(student_id, course_id);

CREATE INDEX IF NOT EXISTS module_completions_course_id_idx
  ON module_completions(course_id);
