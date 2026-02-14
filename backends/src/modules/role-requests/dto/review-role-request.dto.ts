import { IsString, IsOptional } from 'class-validator';

export class ReviewRoleRequestDto {
  @IsOptional()
  @IsString()
  reviewNote?: string;
}
