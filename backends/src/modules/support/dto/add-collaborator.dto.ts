import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Allowed departments mirror schema/ticket-collaborators.ts
// TICKET_COLLAB_DEPARTMENTS. Kept inline (not imported) so the DTO
// stays decoupled from the schema's runtime constant — class-validator
// needs literal arrays.
const ALLOWED_DEPARTMENTS = [
  'course_manager',
  'finance',
  'admin',
  'instructor',
  'ta',
  'supervisor',
] as const;

export class AddCollaboratorDto {
  @IsUUID('4')
  @IsNotEmpty()
  userId: string;

  @IsIn(ALLOWED_DEPARTMENTS)
  department: (typeof ALLOWED_DEPARTMENTS)[number];

  // Optional message the actor sends to the new collaborator as an
  // internal reply. When either `message` or `attachments` is present
  // the service posts an internal ticket reply so the loop-in has
  // context; otherwise the collaborator is added silently (legacy
  // behavior preserved).
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  message?: string;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AddCollaboratorAttachmentDto)
  attachments?: AddCollaboratorAttachmentDto[];
}

export class AddCollaboratorAttachmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  url: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  filename?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  mimeType?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  sizeBytes?: number;
}
