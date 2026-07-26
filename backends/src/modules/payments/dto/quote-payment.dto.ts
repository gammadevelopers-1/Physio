import {
  IsUUID,
  IsOptional,
  IsString,
  IsArray,
  IsBoolean,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

/**
 * Body for POST /payments/quote — runs the same validation pipeline as
 * /payments/initiate (course exists/active, capacity, NELC limits, discount
 * validation, VAT calc) but writes nothing to the DB. Used by the bank-
 * transfer draft flow so the buyer can see real totals before deciding
 * to actually submit a receipt.
 */
export class QuotePaymentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  courseIds: string[];

  @IsOptional()
  @IsString()
  discountCode?: string;

  /**
   * Mirrors InitiatePaymentDto — when true, the quote pipeline also
   * applies the active direct-campaign discount for this cart (in
   * addition to any coupon in `discountCode` when the campaign allows
   * stacking). Silently ignored if no eligible campaign matches.
   */
  @IsOptional()
  @IsBoolean()
  applyActiveCampaign?: boolean;
}
