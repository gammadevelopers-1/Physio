import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { INCIDENT_STATUS_VALUES } from './create-incident.dto';

export const LINKED_RESOLUTION_STRATEGY_VALUES = [
  'soft_resolve',
  'auto_close',
  'leave_open',
] as const;

export class PostIncidentUpdateDto {
  @IsIn(INCIDENT_STATUS_VALUES)
  status: (typeof INCIDENT_STATUS_VALUES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  messageEn: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  messageAr?: string;

  // Only consulted when status='resolved' and there are linked
  // tickets. Defaults to 'soft_resolve' server-side so the agent
  // still has a checkpoint with the requester.
  @IsOptional()
  @IsIn(LINKED_RESOLUTION_STRATEGY_VALUES)
  linkedResolutionStrategy?: (typeof LINKED_RESOLUTION_STRATEGY_VALUES)[number];

  // When status='resolved' for an end-user audience, controls whether
  // we send the "resolved" notification fan-out. Defaults to true.
  @IsOptional()
  @IsBoolean()
  notifyAudience?: boolean;
}
