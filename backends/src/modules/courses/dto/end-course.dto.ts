import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * POST /courses/:id/end — Manager/Admin manually ends an ACTIVE course.
 *
 * Reason is optional (Amna 2026-08-01): the "why did you end this
 * early?" note is a courtesy for the audit trail, not a gate. If left
 * empty the audit metadata simply omits the field.
 */
export class EndCourseDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Reason must not exceed 1000 characters' })
  reason?: string;
}
