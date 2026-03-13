import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RejectCourseTADto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
