-- FIN-03b: invoices.status = 'partially_refunded' for per-course refunds
--
-- After the per-line refund feature landed (migration 0095_refund_items),
-- a partial refund left the parent invoice marked 'paid' because the only
-- terminal-refund status the constraint allowed was 'refunded' (full
-- unwind). The invoice list and student receipt both then showed "Paid"
-- when the buyer had actually been refunded a portion. This extends the
-- constraint so the service layer can record partial state on the
-- invoice row itself.

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'cancelled', 'refunded', 'partially_refunded'));
