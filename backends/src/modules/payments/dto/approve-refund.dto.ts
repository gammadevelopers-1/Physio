import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class ApproveRefundDto {
  @IsOptional()
  @IsString()
  approvalNote?: string;

  /**
   * Optional approve-time amount override. When provided, the refund is
   * approved for this amount instead of the amount requested. Must be
   * positive and ≤ the original requested amount (approve can reduce,
   * never increase). Requires `approvalNote` when it reduces.
   */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  approvedAmount?: number;
}
