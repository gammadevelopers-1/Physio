import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { INTERVENTION_TYPE, InterventionType } from '../../../database/schema';

const validTypes = Object.values(INTERVENTION_TYPE);

// Concern categories an instructor can flag when filing a support
// follow-up. Kept short and concrete so support agents can triage
// quickly. Surfaces on the ticket as a tag + a header chip.
export const INTERVENTION_CONCERN = {
  ATTENDANCE: 'attendance',
  PROGRESS: 'progress',
  ASSESSMENT: 'assessment',
  ENGAGEMENT: 'engagement',
  TECHNICAL: 'technical',
  OTHER: 'other',
} as const;

export type InterventionConcern =
  (typeof INTERVENTION_CONCERN)[keyof typeof INTERVENTION_CONCERN];

const validConcerns = Object.values(INTERVENTION_CONCERN);

export class CreateInterventionDto {
  @IsString()
  @IsNotEmpty({ message: 'Type is required' })
  @IsIn(validTypes, {
    message: `Type must be one of: ${validTypes.join(', ')}`,
  })
  type: InterventionType;

  @IsUUID('4', { message: 'Student ID must be a valid UUID' })
  studentId: string;

  @IsOptional()
  @IsUUID('4', { message: 'Course ID must be a valid UUID' })
  courseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  // Required only when type=ticket. Tells support what kind of
  // follow-up the instructor is asking for so they can triage and
  // route appropriately. Service-layer enforces the type=ticket
  // requirement so callers using other intervention types don't have
  // to send a concern.
  @IsOptional()
  @IsIn(validConcerns, {
    message: `Concern must be one of: ${validConcerns.join(', ')}`,
  })
  concern?: InterventionConcern;
}
