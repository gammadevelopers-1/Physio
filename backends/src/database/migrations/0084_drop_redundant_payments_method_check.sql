-- FIN-02d: drop the duplicate payment_method CHECK constraint.
--
-- Two CHECK constraints existed on payments.payment_method:
--   * payments_method_check          — legacy, missing bank_transfer
--   * payments_payment_method_check  — from migration 0083, includes bank_transfer
--
-- Postgres requires ALL checks to pass, so the legacy one still
-- rejected bank_transfer even after 0083. Dropping it leaves the
-- single, correct constraint in place. IF EXISTS so this is a no-op
-- on dev DBs that were created after the legacy constraint had
-- already been removed.

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
