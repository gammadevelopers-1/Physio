import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class EscalateTicketDto {
  // Free-text reason captured from the supervisor's modal. Stored on
  // the ticket as escalation_reason and surfaced as the tooltip on
  // the ESCALATED chip. Length is bounded so a runaway paste can't
  // bloat a row.
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  // Optional priority bump. Supervisors often escalate because the
  // ticket has been mis-triaged — bumping LOW→MEDIUM or MEDIUM→HIGH
  // in the same action saves a second click. Whitelist is tight so
  // we can't accidentally downgrade by passing 'low'.
  @IsOptional()
  @IsIn(['medium', 'high'])
  bumpPriority?: 'medium' | 'high';
}
