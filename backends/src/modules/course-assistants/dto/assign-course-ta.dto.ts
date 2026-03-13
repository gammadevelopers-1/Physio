import { IsUUID, IsNotEmpty } from 'class-validator';

export class AssignCourseTADto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
