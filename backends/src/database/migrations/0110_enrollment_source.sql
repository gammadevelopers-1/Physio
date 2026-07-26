-- Track how each enrollment came to be so reports + student UI can distinguish
-- paid purchases from points redemptions, admin grants, reward unlocks, and
-- free public enrollments.
ALTER TABLE enrollments
  ADD COLUMN source text NOT NULL DEFAULT 'purchase'
  CONSTRAINT enrollments_source_valid CHECK (source IN
    ('purchase', 'points_redemption', 'admin_grant', 'reward', 'free_public'));

-- Backfill: existing rows priced 0 → 'free_public'; everything else stays 'purchase'.
-- Use a subquery on courses.price at enrollment-time — good enough for backfill.
UPDATE enrollments e
   SET source = 'free_public'
  FROM courses c
 WHERE e.course_id = c.id
   AND COALESCE(c.price::numeric, 0) = 0
   AND e.source = 'purchase';

-- Reports index — only non-purchase rows are interesting to filter on.
CREATE INDEX IF NOT EXISTS enrollments_source_idx
  ON enrollments (source) WHERE source != 'purchase';
