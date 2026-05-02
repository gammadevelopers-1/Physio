import {
  IsString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ResumeFileDto {
  @IsString()
  type: string;

  @IsString()
  url: string;

  @IsString()
  filename: string;
}

export class CreateRoleRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Requested role is required' })
  requestedRole: string;

  @IsObject()
  @IsNotEmpty({ message: 'Profile data is required' })
  profileData: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  bankData?: Record<string, unknown>;

  // Class + nested validation so class-transformer keeps the inner
  // {type,url,filename} fields instead of stripping them to empty arrays.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResumeFileDto)
  resumeFiles?: ResumeFileDto[];

  // Structured resume entries when applicants build their CV in-form
  // instead of uploading a file
  @IsOptional()
  @IsObject()
  structuredResume?: Record<string, unknown>;
}
