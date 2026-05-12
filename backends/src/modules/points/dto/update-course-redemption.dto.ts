import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateCourseRedemptionDto {
  @IsOptional()
  @IsBoolean()
  redeemableForFree?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  freeUnlockCostPoints?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxRedemptionPct?: number | null;
}
