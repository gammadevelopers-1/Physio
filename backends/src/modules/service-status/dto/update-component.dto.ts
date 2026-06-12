import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const COMPONENT_STATUS_VALUES = [
  'operational',
  'degraded',
  'partial_outage',
  'major_outage',
  'maintenance',
] as const;

export class UpdateComponentStatusDto {
  @IsIn(COMPONENT_STATUS_VALUES)
  currentStatus: (typeof COMPONENT_STATUS_VALUES)[number];

  // Optional public-facing message shown beside the status pill.
  // Pass empty string to clear.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  currentMessageEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  currentMessageAr?: string;
}
