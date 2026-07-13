import { IsString, MinLength, MaxLength } from 'class-validator';

export class CancelCourseDto {
  /**
   * Mandatory cancellation reason. Sent to every enrolled student in the
   * cancellation email, recorded on the course row, and captured in both
   * the audit log and the NELC audit trail. Amna's spec: "Cancellation
   * must require a mandatory reason."
   */
  @IsString()
  @MinLength(3, { message: 'Cancellation reason must be at least 3 characters' })
  @MaxLength(1000)
  reason: string;
}

export interface CancelCourseResult {
  cancelledAt: Date;
  variant: 'pre_start' | 'post_start';
  // Post-cascade counts — surfaced to the admin as a "here's what happened" toast.
  refundsIssued: number;      // programmatic refunds that completed (Moyasar/Tamara/Tabby)
  refundsPendingBankTransfer: number; // bank-transfer refunds waiting on manual wire
  refundsFailed: number;      // gateway rejections; admin needs to follow up manually
  refundsDeferred: number;    // Phase C post-start: paid rows deferred to finance-manual review
  paymentsCancelled: number;  // pending/awaiting_approval flipped to failed with reason
  enrollmentsDropped: number;
  sessionsCancelled: number;
  waitlistCleared: number;
  attendanceCancelled: number;    // Phase C: past attendance rows marked cancelled
  certificatesRevoked: number;    // Phase C: issued certs revoked
  pointsReversed: number;         // Phase C: total point delta reversed (absolute value)
  studentsNotified: number;
}
