import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class UpdateRuleDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  pointsAmount?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerUser?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  cooldownSeconds?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionAr?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresAfterDays?: number | null;
}
