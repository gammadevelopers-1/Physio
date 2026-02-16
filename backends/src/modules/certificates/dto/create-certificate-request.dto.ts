import { IsUUID } from 'class-validator';

export class CreateCertificateRequestDto {
  @IsUUID('4', { message: 'Course ID must be a valid UUID' })
  courseId: string;
}
