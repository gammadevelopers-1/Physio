import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewMaterialDto {
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
