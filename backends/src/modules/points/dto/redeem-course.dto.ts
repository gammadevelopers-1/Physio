import { IsUUID } from 'class-validator';

export class RedeemCourseDto {
  @IsUUID()
  courseId!: string;
}
