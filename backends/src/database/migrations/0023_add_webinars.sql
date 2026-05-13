-- Zoom Webinar support. Webinars live alongside Meetings: a session is
-- either a meeting (meeting_id set) or a webinar (zoom_webinar_id set),
-- never both. is_webinar is the source-of-truth flag.

ALTER TABLE "sessions"
    ADD COLUMN IF NOT EXISTS "is_webinar" boolean NOT NULL DEFAULT false;

ALTER TABLE "sessions"
    ADD COLUMN IF NOT EXISTS "zoom_webinar_id" varchar(50);

ALTER TABLE "sessions"
    ADD COLUMN IF NOT EXISTS "webinar_registration_url" varchar(500);

-- One row per registrant per webinar session. Backed by both the auto-
-- registration endpoint AND the webinar.registration_created webhook (the
-- latter is the canonical source for external attendees registering on the
-- Zoom-hosted page).
CREATE TABLE IF NOT EXISTS "webinar_registrations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
    "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
    "email" varchar(255) NOT NULL,
    "first_name" varchar(100),
    "last_name" varchar(100),
    "phone" varchar(50),
    "national_id" varchar(50),
    "scfhs_number" varchar(50),
    "zoom_registrant_id" varchar(100),
    "join_url" text,
    "status" varchar(20) NOT NULL DEFAULT 'approved',
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "webinar_registrations_session_id_idx"
    ON "webinar_registrations" ("session_id");

CREATE INDEX IF NOT EXISTS "webinar_registrations_user_id_idx"
    ON "webinar_registrations" ("user_id");

CREATE INDEX IF NOT EXISTS "webinar_registrations_email_idx"
    ON "webinar_registrations" ("email");

-- Zoom dedupes registrants by email per webinar; mirror that constraint here.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'webinar_registrations_session_email_unique'
    ) THEN
        ALTER TABLE "webinar_registrations"
            ADD CONSTRAINT "webinar_registrations_session_email_unique"
            UNIQUE ("session_id", "email");
    END IF;
END$$;
