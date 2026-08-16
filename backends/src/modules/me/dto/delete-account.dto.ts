import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CancelDeletionDto {
  @IsString()
  @MinLength(20)
  token!: string;
}
