import {
  IsString,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
  Matches,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Body for POST /payments/bank-transfer/submit-draft — the one-shot endpoint
 * that creates a brand new bank-transfer payment + its receipt atomically.
 *
 * Multipart: the receipt file rides under field "file"; everything below is
 * sent as form fields. `courseIds` is the cart, repeated as `courseIds[]` or
 * comma-joined — class-transformer normalizes both to a string[] array.
 */
export class SubmitDraftDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return value;
  })
  courseIds: string[];

  @IsOptional()
  @IsString()
  discountCode?: string;

  /**
   * Multipart form fields arrive as strings — normalize "true"/"1" to a
   * real boolean so class-validator's @IsBoolean accepts it. When true,
   * the underlying `quotePayment` also applies the active direct-campaign
   * discount on top of any coupon in `discountCode`.
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const v = value.toLowerCase();
      if (v === 'true' || v === '1') return true;
      if (v === 'false' || v === '0' || v === '') return false;
    }
    return value;
  })
  applyActiveCampaign?: boolean;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  refundAccountHolder: string;

  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() : value,
  )
  @Matches(/^SA\d{22}$/, {
    message:
      'IBAN must be a valid Saudi IBAN (SA + 22 digits, 24 characters total)',
  })
  refundIban: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  refundBankName: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  refundNationalId?: string;
}
