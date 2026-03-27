import { IsString, IsOptional, IsIn, IsUUID, MaxLength } from 'class-validator';

export class UpdateTicketDto {
  @IsIn(['new', 'in_progress', 'on_hold', 'resolved', 'closed'])
  @IsOptional()
  status?: string;

  @IsIn(['high', 'medium', 'low'])
  @IsOptional()
  priority?: string;

  @IsUUID('4')
  @IsOptional()
  assigneeId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  onHoldReason?: string;
}
