import {
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';

/**
 * Finance-manager controls for a course-level sale (no coupon required).
 * Sales are a pricing/promotion decision and are managed from the finance
 * dashboard — NOT from the course editor. `null` clears a field (turns the
 * sale off); an omitted field is left unchanged.
 */
export class SetCourseSaleDto {
  // 1..100 (100 = free). null clears the sale.
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(100)
  salePercent?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  saleStartsAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsDateString()
  saleEndsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  saleAllowsCoupon?: boolean;
}
