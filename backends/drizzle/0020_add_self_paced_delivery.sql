-- Add 'self-paced' to delivery type check constraint
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_delivery_type_check;
ALTER TABLE courses ADD CONSTRAINT courses_delivery_type_check CHECK (delivery_type IN ('zoom', 'onsite', 'blended', 'self-paced'));
