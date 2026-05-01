import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

interface ResumeFile {
  type: string;
  url: string;
  filename: string;
}

export class SubmitApplicationDto {
  @IsObject()
  profileData: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  bankData?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  resumeFiles?: ResumeFile[];

  @IsOptional()
  @IsString()
  locale?: string;
}
