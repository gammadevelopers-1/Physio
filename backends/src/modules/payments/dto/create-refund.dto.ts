import {
  IsUUID,
  IsIn,
  IsOptional,
  IsString,
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  Length,
  ValidateIf,
} from 'class-validator';

export class CreateRefundDto {
  @IsUUID()
  paymentId!: string;

  // `policy` is kept for backward compat with historical rows and admin
  // tools; the buyer modal no longer exposes it. `course_cancelled` is
  // admin-initiated only — the buyer modal never sends it.
  @IsIn([
    'policy',
    'cancelled',
    'technical',
    'duplicate',
    'other',
    'course_cancelled',
    'description_mismatch',
    'wrong_course',
    'access_issue',
  ])
  reason!: string;

  // When reason === 'other' the free-text note is required — that's the
  // only signal finance has to interpret the request. For every other
  // reason the note is optional (extra context is welcome, not required);
  // if the client sent one, we still enforce the 3–500 char shape.
  //
  // Combining `@IsOptional` with `@ValidateIf` breaks class-validator
  // (they're AND-ed and would skip validation exactly when we need it),
  // so we drive the whole thing off one ValidateIf that includes both
  // gates: "reason is other" OR "a non-empty note was actually sent".
  @ValidateIf(
    (o) =>
      o.reason === 'other' ||
      (typeof o.reasonNote === 'string' && o.reasonNote.length > 0),
  )
  @IsString()
  @Length(3, 500)
  reasonNote?: string;

  /**
   * Optional subset of payment_items.id values to refund. Absent or empty =
   * full-payment refund (every line). When provided, the refund amount is
   * derived from the selected lines (sum of line_total + apportioned VAT
   * and discount) — callers should NOT pass refundAmount and paymentItemIds
   * together; if both are present the explicit refundAmount wins for
   * admin-initiated overrides only.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  paymentItemIds?: string[];
}
