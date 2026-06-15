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
  Max,
} from 'class-validator';

export class BulkDiscountDto {
  @IsString()
  prefix: string;

  @IsInt()
  @Min(1)
  @Max(100)
  count: number;

  @IsIn(['percentage', 'fixed'])
  type: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

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
