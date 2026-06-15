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

export const INCIDENT_AUDIENCE_VALUES = ['internal', 'end_users'] as const;

// Role names that can appear in affectedRoles. Mirrors
// INCIDENT_AFFECTED_ROLES in schema/service-status.ts.
export const INCIDENT_AFFECTED_ROLE_VALUES = [
  'STUDENT',
  'INSTRUCTOR',
  'MANAGER',
  'TEACHING_ASSISTANT',
  'FINANCE',
] as const;

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

  // 'internal' (default — ops/dev incidents that don't surface
  // outside admin) vs 'end_users' (drives the cross-dashboard banner
  // + role-targeted notifications). Optional so existing clients
  // don't break; defaults to 'internal' server-side.
  @IsOptional()
  @IsIn(INCIDENT_AUDIENCE_VALUES)
  audience?: (typeof INCIDENT_AUDIENCE_VALUES)[number];

  // Required when audience='end_users'. Server-side guard checks
  // for at least one role in that case.
  @IsOptional()
  @IsArray()
  @IsIn(INCIDENT_AFFECTED_ROLE_VALUES, { each: true })
  affectedRoles?: (typeof INCIDENT_AFFECTED_ROLE_VALUES)[number][];
}
