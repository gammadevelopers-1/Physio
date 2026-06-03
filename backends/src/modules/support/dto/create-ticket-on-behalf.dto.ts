import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTicketOnBehalfDto {
  @IsUUID('4')
  @IsNotEmpty()
  studentId: string;

  @IsIn(['billing', 'login', 'content', 'certificate', 'technical', 'other'])
  @IsNotEmpty()
  category: string;

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
}
