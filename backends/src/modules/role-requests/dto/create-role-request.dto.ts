import {
  IsString,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsArray,
} from 'class-validator';

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

  @IsOptional()
  @IsArray()
  resumeFiles?: Array<{ type: string; url: string; filename: string }>;

  // Structured resume entries when applicants build their CV in-form
  // instead of uploading a file
  @IsOptional()
  @IsObject()
  structuredResume?: Record<string, unknown>;
}
