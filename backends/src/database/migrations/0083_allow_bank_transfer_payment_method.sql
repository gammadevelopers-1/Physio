-- FIN-02c: allow 'bank_transfer' as a payment_method.
--
-- The DTO already accepts bank_transfer as a valid value (see
-- InitiatePaymentDto.paymentMethod IsIn list). The DB CHECK constraint
-- did not — it was added before bank transfer existed and was never
-- extended. Every bank-transfer checkout currently 500s on the INSERT
-- with a constraint violation.
--
-- Drop the old constraint by its system-assigned name and re-create
-- with the full set. The list mirrors the DTO and matches the
-- gateway list (so a 'bank_transfer' payment_method aligns 1:1 with a
-- 'bank_transfer' gateway row).

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_payment_method_check
  CHECK (
    payment_method IS NULL
    OR payment_method IN ('card', 'mada', 'apple_pay', 'bnpl', 'bank_transfer')
  );
