import { IsUUID, IsNotEmpty, IsOptional, IsIn, IsInt, Min } from 'class-validator';

export class UpdateProgressDto {
  @IsUUID('4')
  @IsNotEmpty()
  moduleId: string;

  @IsOptional()
  @IsIn(['completed', 'in_progress'])
  status?: string;

  @IsOptional()
  @IsUUID('4')
  materialId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  watchedSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalSeconds?: number;
}
