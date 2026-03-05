-- Course review workflow: add pending_review / changes_requested statuses and review columns

ALTER TABLE courses ADD COLUMN review_note VARCHAR(1000);
ALTER TABLE courses ADD COLUMN reviewed_by UUID REFERENCES users(id);
ALTER TABLE courses ADD COLUMN submitted_at TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN reviewed_at TIMESTAMPTZ;

-- Drop old status check constraint, add new one with 6 statuses
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_status_check;
ALTER TABLE courses ADD CONSTRAINT courses_status_check
  CHECK (status IN ('draft', 'pending_review', 'changes_requested', 'active', 'completed', 'archived'));
