import {
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  NotEquals,
} from 'class-validator';

/**
 * Admin manual grant or deduction.
 * Positive `delta` = grant, negative = deduction.
 * Reason is required (audit trail visible to support).
 */
export class GrantPointsDto {
  @IsUUID()
  userId!: string;

  @IsInt()
  @NotEquals(0)
  delta!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason!: string;
}
