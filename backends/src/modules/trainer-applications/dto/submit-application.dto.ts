import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Class (not interface) so class-transformer with whitelist+transform
// preserves the inner properties. With a plain interface, class-validator
// strips the object contents and we end up storing [[], []] in the DB.
class ResumeFileDto {
  @IsString()
  type: string;

  @IsString()
  url: string;

  @IsString()
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
  @ValidateNested({ each: true })
  @Type(() => ResumeFileDto)
  resumeFiles?: ResumeFileDto[];

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
