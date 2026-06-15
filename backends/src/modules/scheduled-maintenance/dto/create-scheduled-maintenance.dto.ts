import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateScheduledMaintenanceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titleEn: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionAr?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedComponents?: string[];

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  // 0 = skip pre-notification, otherwise minutes before start.
  // Cap at 14 days so we don't notify weeks in advance.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(14 * 24 * 60)
  preNotificationLeadMinutes?: number;
}
