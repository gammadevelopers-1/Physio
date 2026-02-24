import { IsOptional, IsBoolean, IsInt, IsIn } from 'class-validator';

export class UpdateNotificationPrefsDto {
  @IsOptional()
  @IsBoolean()
  emailNewStudent?: boolean;

  @IsOptional()
  @IsBoolean()
  emailCourseComplete?: boolean;

  @IsOptional()
  @IsBoolean()
  emailAssessmentSubmit?: boolean;

  @IsOptional()
  @IsBoolean()
  emailCertificateRequest?: boolean;

  @IsOptional()
  @IsBoolean()
  pushNewSession?: boolean;

  @IsOptional()
  @IsBoolean()
  pushStudentMessage?: boolean;

  @IsOptional()
  @IsBoolean()
  pushSystemUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  digestWeekly?: boolean;

  @IsOptional()
  @IsBoolean()
  digestMonthly?: boolean;

  @IsOptional()
  @IsInt()
  @IsIn([15, 30, 60])
  reminderMinutes?: number;
}
