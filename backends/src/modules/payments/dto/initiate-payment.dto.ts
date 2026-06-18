import {
  IsUUID,
  IsIn,
  IsOptional,
  IsString,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class InitiatePaymentDto {
  // Multi-course cart: one payment, many line items. Sent as an array even
  // for a single-course express purchase so the backend has a single shape
  // to validate.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  courseIds: string[];

  @IsIn(['moyasar', 'tamara', 'tabby', 'bank_transfer', 'mock'])
  gateway: string;

  @IsIn(['card', 'mada', 'apple_pay', 'bnpl', 'bank_transfer'])
  paymentMethod: string;

  @IsOptional()
  @IsString()
  discountCode?: string;

  @IsOptional()
  @IsIn(['ar', 'en'])
  locale?: string;
}
