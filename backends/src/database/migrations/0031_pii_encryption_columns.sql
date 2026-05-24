-- Application-layer encryption for sensitive PII fields on `users`.
-- The columns themselves stay in place; we just widen their type to
-- hold the encrypted ciphertext (which is ~3x longer than the
-- plaintext after base64-encoding the IV + auth-tag + payload).
--
-- Format written by `encryptPII()`:
--   v1:<base64-iv>:<base64-authTag>:<base64-ciphertext>
--
-- Backward-compat: legacy plaintext rows (no `v1:` prefix) keep being
-- readable. `decryptPII()` passes them through unchanged, and any new
-- write goes through `encryptPII()` so the row gets re-encrypted on
-- next save. A separate backfill script can convert all legacy rows in
-- one pass later, after we verify the encrypted path works in prod.
--
-- Postgres-internal note: changing varchar(N) → text is a metadata-only
-- ALTER on PG ≥ 9.2 (no table rewrite, no lock beyond schema-update),
-- so it's safe to apply on a live system without downtime.

ALTER TABLE users
  ALTER COLUMN national_id    TYPE text,
  ALTER COLUMN phone          TYPE text,
  ALTER COLUMN scfhs_number   TYPE text;
