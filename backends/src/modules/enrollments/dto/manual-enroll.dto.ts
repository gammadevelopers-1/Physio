import { IsUUID, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

/**
 * Admin/manager manual enrollment payload. Reason is mandatory —
 * captured in enrollments.enrollment_reason + written to audit_logs so
 * finance/compliance can trace why the student was added outside the
 * normal self-service flow.
 */
export class ManualEnrollDto {
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
