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
