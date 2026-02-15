import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class ReviewRoleRequestDto {
  @IsOptional()
  @IsString()
  reviewNote?: string;

  @IsOptional()
  @IsBoolean()
  blockNationalId?: boolean;
}
