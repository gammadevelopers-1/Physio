import { IsUUID, IsIn, IsOptional, IsString } from 'class-validator';

export class InitiatePaymentDto {
  @IsUUID()
  courseId: string;

  @IsIn(['tap', 'moyasar', 'tamara', 'tabby', 'mock'])
  gateway: string;

  @IsIn(['card', 'mada', 'apple_pay', 'bnpl'])
  paymentMethod: string;

  @IsOptional()
  @IsString()
  discountCode?: string;

  @IsOptional()
  @IsIn(['ar', 'en'])
  locale?: string;
}
