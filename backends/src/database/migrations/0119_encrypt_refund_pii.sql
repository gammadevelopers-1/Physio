-- Widen refund PII columns to accept AES-256-GCM ciphertext produced by
-- encryptPII() (see backends/src/common/crypto.ts). Same pattern already
-- used for users.national_id / phone / scfhs_number (all TEXT).
--
-- Encrypted format: `v1:<b64-iv>:<b64-authTag>:<b64-ciphertext>`
--   34-char IBAN → ~92 chars encrypted
--   20-char NID  → ~72 chars encrypted
-- VARCHAR(34)/VARCHAR(20) can't hold that. TEXT can.
--
-- The encryption layer is null-safe and format-aware: legacy plaintext rows
-- (without the `v1:` prefix) are returned unchanged by decryptPII(), so this
-- migration is additive — no reads break. A one-shot backfill script rewrites
-- historical rows into the encrypted format after the code is deployed.

ALTER TABLE "payment_receipts" ALTER COLUMN "refund_iban" TYPE text;
ALTER TABLE "payment_receipts" ALTER COLUMN "refund_national_id" TYPE text;
