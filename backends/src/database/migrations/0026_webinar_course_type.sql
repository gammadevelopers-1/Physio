-- Adds the new 'webinar' value to the courses.delivery_type CHECK constraint.
-- Webinar Courses are attendance-only (no modules, no assessments, only
-- webinar sessions). Restrictions are enforced at the API layer; this
-- migration only widens the allowed delivery_type values.

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_delivery_type_check;

ALTER TABLE courses
  ADD CONSTRAINT courses_delivery_type_check
  CHECK (delivery_type IN ('zoom', 'onsite', 'blended', 'self-paced', 'webinar'));
