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

  // Structured resume from the "Create Resume" path:
  // { education: [...], professionalSkills: [...],
  //   scientificResearches: [...], trainingExperiences: [...] }
  @IsOptional()
  @IsObject()
  structuredResume?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  locale?: string;
}
