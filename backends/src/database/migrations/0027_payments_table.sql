-- Payments table — captures every checkout transaction (placeholder today,
-- real provider records once Stripe/HyperPay is wired). The finance
-- dashboard will read from this table; webinar/standard course flows both
-- write the same shape so the dashboard doesn't need to know about course
-- types.

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  provider VARCHAR(50) NOT NULL DEFAULT 'placeholder',
  provider_ref VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_status_check
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded'))
);

CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments (user_id);
CREATE INDEX IF NOT EXISTS payments_course_id_idx ON payments (course_id);
CREATE INDEX IF NOT EXISTS payments_enrollment_id_idx ON payments (enrollment_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status);
CREATE INDEX IF NOT EXISTS payments_created_at_idx ON payments (created_at);
