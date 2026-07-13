import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsDateString,
} from 'class-validator';

export class RescheduleCourseDto {
  @IsString()
  @MinLength(3, { message: 'Reschedule reason must be at least 3 characters' })
  @MaxLength(1000)
  reason: string;

  @IsDateString()
  newStartDate: string;

  @IsOptional()
  @IsDateString()
  newEndDate?: string;
}

export interface RescheduleCourseResult {
  rescheduledAt: Date;
  variant: 'shift' | 'revive';
  newStartDate: string;
  newEndDate: string | null;
  originalStartDate: string | null;
  sessionsShifted: number;
  sessionsFailed: number;
  zoomUpdatesFailed: number;
  studentsNotified: number;
  revivedFromCancelled: boolean;
  droppedEnrollmentsPreserved: number;
}
