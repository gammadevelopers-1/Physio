import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsIn,
  IsUUID,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ASSESSMENT_TYPE,
  AssessmentType,
} from '../../../database/schema';

const validTypes = Object.values(ASSESSMENT_TYPE);

export class CreateAssessmentDto {
  @IsUUID('4', { message: 'Course ID must be a valid UUID' })
  courseId: string;

  @IsOptional()
  @IsUUID('4', { message: 'Module ID must be a valid UUID' })
  moduleId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Type is required' })
  @IsIn(validTypes, {
    message: `Type must be one of: ${validTypes.join(', ')}`,
  })
  type: AssessmentType;

  @IsInt()
  @Min(1)
  totalMarks: number;

  @IsInt()
  @Min(0)
  passingMarks: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  attemptsAllowed?: number;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  instructions?: string;

  @IsOptional()
  @IsBoolean()
  randomizeOrder?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  questionsPerAttempt?: number;
}
