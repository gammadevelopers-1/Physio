import { IsUUID, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class UpdateProgressDto {
  @IsUUID('4')
  @IsNotEmpty()
  moduleId: string;

  @IsOptional()
  @IsIn(['completed', 'in_progress'])
  status?: string;
}
