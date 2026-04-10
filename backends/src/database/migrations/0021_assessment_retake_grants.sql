-- Per-student retake grants. Manager grants individual retakes from the
-- submissions list; no cap; assignment retakes can carry a per-student
-- newDueDate. usedAt is set when the student starts/submits the retake.

CREATE TABLE IF NOT EXISTS "assessment_retake_grants" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "assessment_id" uuid NOT NULL REFERENCES "assessments"("id") ON DELETE CASCADE,
    "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "granted_by" uuid NOT NULL REFERENCES "users"("id"),
    "reason" text,
    "new_due_date" timestamp,
    "used_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "assessment_retake_grants_assessment_idx"
    ON "assessment_retake_grants" ("assessment_id");

CREATE INDEX IF NOT EXISTS "assessment_retake_grants_student_idx"
    ON "assessment_retake_grants" ("student_id");

CREATE INDEX IF NOT EXISTS "assessment_retake_grants_unused_idx"
    ON "assessment_retake_grants" ("assessment_id", "student_id", "used_at");
