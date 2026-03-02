import {
  IsString,
  IsIn,
  IsNumber,
  IsOptional,
  IsUUID,
  IsDateString,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';

export class UpdateDiscountDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsIn(['percentage', 'fixed'])
  type?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
