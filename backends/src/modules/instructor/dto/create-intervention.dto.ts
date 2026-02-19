import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { INTERVENTION_TYPE, InterventionType } from '../../../database/schema';

const validTypes = Object.values(INTERVENTION_TYPE);

export class CreateInterventionDto {
  @IsString()
  @IsNotEmpty({ message: 'Type is required' })
  @IsIn(validTypes, {
    message: `Type must be one of: ${validTypes.join(', ')}`,
  })
  type: InterventionType;

  @IsUUID('4', { message: 'Student ID must be a valid UUID' })
  studentId: string;

  @IsOptional()
  @IsUUID('4', { message: 'Course ID must be a valid UUID' })
  courseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
