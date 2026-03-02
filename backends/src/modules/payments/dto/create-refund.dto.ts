import { IsUUID, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateRefundDto {
  @IsUUID()
  paymentId: string;

  @IsIn(['course_issue', 'personal', 'technical', 'duplicate', 'other'])
  reason: string;

  @IsOptional()
  @IsString()
  reasonNote?: string;
}
