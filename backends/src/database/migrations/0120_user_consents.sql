-- Immutable ledger of user consent events. One row per (user, type, version)
-- accepted at a moment in time. `withdrawnAt` handles opt-outs without
-- deleting the original proof-of-consent. Cascade on user delete so that
-- account erasure removes the consent trail too (PDPL right of erasure).

CREATE TABLE "user_consents" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "consent_type" varchar(32) NOT NULL,
    "version" varchar(32) NOT NULL,
    "accepted_at" timestamp DEFAULT now() NOT NULL,
    "withdrawn_at" timestamp,
    "ip_address" varchar(64),
    "user_agent" text,
    CONSTRAINT "user_consents_user_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "user_consents_user_id_idx" ON "user_consents"("user_id");
CREATE INDEX "user_consents_type_idx" ON "user_consents"("consent_type");
