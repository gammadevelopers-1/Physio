import { IsString, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Data the student submits alongside their bank transfer receipt.
 * Captures KSA-specific refund info as a snapshot at upload time so finance
 * can wire a manual refund back if the payment is later reversed.
 */
export class CreateReceiptDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  refundAccountHolder: string;

  // KSA IBAN format: starts with "SA" + 22 digits → 24 characters total.
  // Accept the IBAN with or without spaces; we strip and uppercase before validation.
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\s+/g, '').toUpperCase() : value,
  )
  @Matches(/^SA\d{22}$/, {
    message: 'IBAN must be a valid Saudi IBAN (SA + 22 digits, 24 characters total)',
  })
  refundIban: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  refundBankName: string;

  // Optional National ID or Iqama (10 digits typical for KSA).
  @IsOptional()
  @IsString()
  @MaxLength(20)
  refundNationalId?: string;
}
