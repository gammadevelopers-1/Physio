import {
  IsString,
  IsIn,
  IsNumber,
  IsOptional,
  IsUUID,
  IsArray,
  IsDateString,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateDiscountDto {
  @IsString()
  code: string;

  @IsIn(['percentage', 'fixed'])
  type: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  // Per-user redemption cap. Omit for the default (1 use per user).
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsesPerUser?: number;

  // Optional promotional-campaign grouping label.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  campaign?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  courseIds?: string[];

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
