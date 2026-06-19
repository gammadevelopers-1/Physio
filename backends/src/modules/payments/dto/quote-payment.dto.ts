import {
  IsUUID,
  IsOptional,
  IsString,
  IsArray,
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
}
