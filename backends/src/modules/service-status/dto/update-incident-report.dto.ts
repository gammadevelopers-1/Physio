import { IsOptional, IsString, MaxLength } from 'class-validator';

// Used by the post-mortem panel to set root cause + corrective
// actions on a (typically resolved) incident.
export class UpdateIncidentReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  rootCause?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  correctiveActions?: string;
}
