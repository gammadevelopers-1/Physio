import {
  IsUUID,
  IsIn,
  IsOptional,
  IsString,
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
} from 'class-validator';

export class CreateRefundDto {
  @IsUUID()
  paymentId: string;

  @IsIn(['policy', 'cancelled', 'technical', 'duplicate', 'other'])
  reason: string;

  @IsOptional()
  @IsString()
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
