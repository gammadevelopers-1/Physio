import { IsUUID, IsIn, IsOptional, IsString } from 'class-validator';

export class InitiatePaymentDto {
  @IsUUID()
  courseId: string;

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
