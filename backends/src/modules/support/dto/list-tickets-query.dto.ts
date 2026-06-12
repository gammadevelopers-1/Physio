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

  // Dashboard-of-origin filter. Each role's Support tab scopes its
  // inbox to tickets raised from that dashboard so a multi-role user
  // (e.g. instructor + course-manager + TA) does not see a unified
  // pile across every Support tab.
  @IsIn(['student', 'instructor', 'course_manager', 'finance', 'ta', 'intervention'])
  @IsOptional()
  source?: string;

  // Escalation filter. Whitelist:
  //   '1' / 'true' → only tickets with escalated_at IS NOT NULL
  //   '0' / 'false' → only tickets with escalated_at IS NULL
  // Anything else (or omitted) returns the full set.
  @IsIn(['1', '0', 'true', 'false'])
  @IsOptional()
  escalated?: string;

  @IsNumberString()
  @IsOptional()
  page?: string;

  @IsNumberString()
  @IsOptional()
  limit?: string;
}
