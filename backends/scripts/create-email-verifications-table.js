/* One-off DDL: create email_verifications table on production.
   Run with: DATABASE_URL=... node scripts/create-email-verifications-table.js
   Idempotent — safe to run multiple times.
*/
/* eslint-disable */
const { Client } = require('pg');

const DDL = `
CREATE TABLE IF NOT EXISTS "email_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL,
  "code_hash" varchar(64) NOT NULL,
  "purpose" varchar(50) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "is_used" boolean DEFAULT false NOT NULL,
  "ip_hash" varchar(64),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "email_verifications_email_purpose_idx"
  ON "email_verifications" ("email", "purpose", "is_used");

CREATE INDEX IF NOT EXISTS "email_verifications_created_at_idx"
  ON "email_verifications" ("created_at");
`;

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query(DDL);
    console.log('OK — email_verifications ready.');
  } catch (e) {
    console.error('Failed:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
