import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ResumeFileDto {
  @IsString()
  type!: string;

  @IsString()
  url!: string;

  @IsString()
  filename!: string;
}

/**
 * Portal resubmit body. The applicant's email comes from the scoped
 * JWT (verified via OTP) — never trusted from the body. The
 * `roleRequestId` ties this submission to a specific MORE_INFO
 * application; the service double-checks ownership via the email.
 */
export class PortalResubmitDto {
  @IsUUID()
  roleRequestId!: string;

  @IsObject()
  profileData!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  bankData?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResumeFileDto)
  resumeFiles?: ResumeFileDto[];

  @IsOptional()
  @IsObject()
  structuredResume?: Record<string, unknown>;
}
