import { IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';

export class UpdatePolicyPrefsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  policyEnrollmentLimit?: number;

  @IsOptional()
  @IsBoolean()
  policyRequireContentReview?: boolean;

  @IsOptional()
  @IsBoolean()
  policyAutoApproveCertificates?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  policyCancellationNoticeHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  policyMaxInstructorWeeklyHours?: number;

  @IsOptional()
  @IsBoolean()
  policyEnforceNelcCompliance?: boolean;
}
