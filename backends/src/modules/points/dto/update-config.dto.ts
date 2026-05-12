import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  conversionRatePointsPerSar?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minRedemptionPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxRedemptionPct?: number;

  @IsOptional()
  @IsBoolean()
  combinableWithCoupons?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultExpirationDays?: number | null;
}
