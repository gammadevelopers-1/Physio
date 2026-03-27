import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTicketDto {
  @IsIn(['billing', 'login', 'content', 'certificate', 'technical', 'other'])
  @IsNotEmpty()
  category: string;

  @IsIn(['high', 'medium', 'low'])
  @IsOptional()
  priority?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @IsUUID('4')
  @IsOptional()
  courseId?: string;

  @IsString()
  @IsOptional()
  attachmentUrl?: string;
}
