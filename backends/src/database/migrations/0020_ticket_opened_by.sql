-- Migration: Add opened_by column to tickets for instructor-on-behalf tracking
-- Chapter 2: Student Opens a Ticket

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "opened_by" UUID REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "tickets_opened_by_idx" ON "tickets" ("opened_by") WHERE "opened_by" IS NOT NULL;

COMMENT ON COLUMN "tickets"."opened_by" IS 'User ID of instructor/staff who opened ticket on behalf of student. NULL = student opened it themselves.';
