import {
  IsString,
  IsOptional,
  IsIn,
  IsUUID,
  IsNumberString,
} from 'class-validator';

export class ListTicketsQueryDto {
  @IsIn(['new', 'in_progress', 'on_hold', 'resolved', 'closed'])
  @IsOptional()
  status?: string;

  @IsIn(['high', 'medium', 'low'])
  @IsOptional()
  priority?: string;

  @IsIn(['billing', 'login', 'content', 'certificate', 'technical', 'other'])
  @IsOptional()
  category?: string;

  @IsUUID('4')
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  search?: string;

  // Comma-separated tag UUIDs. AND semantics: a ticket must carry all
  // listed tags to match (so chips compose to narrow, not widen, the
  // result set). Empty/missing = no filter.
  @IsString()
  @IsOptional()
  tags?: string;

  @IsNumberString()
  @IsOptional()
  page?: string;

  @IsNumberString()
  @IsOptional()
  limit?: string;
}
