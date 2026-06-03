import { IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateSlaPolicyDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  frtMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  ttrMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  escalateAfterMinutes?: number;
}
