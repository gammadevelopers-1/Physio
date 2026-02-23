import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class ReviewMaterialDto {
  @IsIn(['approved', 'rejected', 'changes_requested'])
  decision: 'approved' | 'rejected' | 'changes_requested';

  @ValidateIf((o) => o.decision === 'changes_requested' || o.decision === 'rejected')
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
