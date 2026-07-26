import {
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  IsNumber,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';

/**
 * Finance-manager controls for a course-level sale (no coupon required).
 * Sales are a pricing/promotion decision and are managed from the finance
 * dashboard — NOT from the course editor.
 *
 * A sale is either PERCENTAGE (`salePercent` 1..100) or FIXED AMOUNT
 * (`saleAmount` > 0, ≤ the course's price) — never both. The service
 * layer rejects requests that set both. `null` clears a field (turns the
 * sale off); an omitted field is left unchanged.
 */
export class SetCourseSaleDto {
  // 1..100 (100 = free). null clears the percentage sale.
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(100)
  salePercent?: number | null;

  // Positive SAR value ≤ course price (upper bound enforced in service).
  // null clears the fixed-amount sale.
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  saleAmount?: number | null;

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
