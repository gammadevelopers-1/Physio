import { IsOptional, IsIn, IsUUID } from 'class-validator';
import { ON_HOLD_REASONS } from '../../../database/schema';

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

  // Closed enum so the auto-close cron's literal match on
  // "waiting for student response" can't silently break on typos.
  @IsIn(Object.values(ON_HOLD_REASONS))
  @IsOptional()
  onHoldReason?: string;
}
