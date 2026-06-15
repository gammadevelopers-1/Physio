-- Add 'pending_payment' to enrollment status check constraint
-- This prepares the enrollment system for the payment integration flow
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_status_check;
ALTER TABLE enrollments ADD CONSTRAINT enrollments_status_check
  CHECK (status IN ('pending_payment', 'active', 'completed', 'dropped', 'suspended'));
