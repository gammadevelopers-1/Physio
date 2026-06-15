import { IsString, IsUUID } from 'class-validator';

export class ValidateDiscountDto {
  @IsString()
  code: string;

  @IsUUID()
  courseId: string;
}
