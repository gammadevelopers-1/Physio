-- Add 'ended' status to sessions table
-- This intermediate status allows instructors to edit attendance after ending a session
-- before finalizing (locking) it to 'completed'

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('scheduled', 'live', 'ended', 'completed', 'cancelled'));
