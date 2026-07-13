-- Course lifecycle Phase C — post-start cancel needs to preserve
-- historical attendance rows for NELC audit while marking them
-- cancelled. Amna: "All learner attendance must first be cancelled/
-- removed" AND "records must always be preserved" for compliance.
-- Adding 'cancelled' to the status CHECK lets the cancel cascade
-- update-in-place instead of deleting rows (which would break audit).

ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'absent', 'late', 'excused', 'cancelled'));
