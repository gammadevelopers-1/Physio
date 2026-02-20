import { IsUUID, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class AssignAssistantDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsIn(['co_host', 'assistant'])
  role?: string;
}
