import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const INCIDENT_STATUS_VALUES = [
  'investigating',
  'identified',
  'monitoring',
  'resolved',
] as const;

export const INCIDENT_SEVERITY_VALUES = ['minor', 'major', 'critical'] as const;

export class CreateIncidentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titleEn: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleAr?: string;

  @IsArray()
  @IsString({ each: true })
  affectedComponents: string[];

  @IsIn(INCIDENT_SEVERITY_VALUES)
  severity: (typeof INCIDENT_SEVERITY_VALUES)[number];

  // The first timeline update — required so an incident always has
  // at least one message to display.
  @IsIn(INCIDENT_STATUS_VALUES)
  initialStatus: (typeof INCIDENT_STATUS_VALUES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  initialMessageEn: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  initialMessageAr?: string;
}
