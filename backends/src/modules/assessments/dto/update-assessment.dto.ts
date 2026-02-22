import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsUUID,
  IsBoolean,
  IsObject,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ASSESSMENT_TYPE,
  ASSESSMENT_STATUS,
  AssessmentType,
  AssessmentStatus,
} from '../../../database/schema';

const validTypes = Object.values(ASSESSMENT_TYPE);
const validStatuses = Object.values(ASSESSMENT_STATUS);

export class UpdateAssessmentDto {
  @IsOptional()
  @IsUUID('4', { message: 'Module ID must be a valid UUID' })
  moduleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @IsIn(validTypes, {
    message: `Type must be one of: ${validTypes.join(', ')}`,
  })
  type?: AssessmentType;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalMarks?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  passingMarks?: number;

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
  @IsIn(validStatuses, {
    message: `Status must be one of: ${validStatuses.join(', ')}`,
  })
  status?: AssessmentStatus;

  // Proctoring
  @IsOptional()
  @IsBoolean()
  proctoringEnabled?: boolean;

  @IsOptional()
  @IsObject()
  proctoringRules?: {
    webcamRequired?: boolean;
    browserLockdown?: boolean;
    tabSwitchAlert?: boolean;
  };

  @IsOptional()
  @IsBoolean()
  timeLimitEnforced?: boolean;

  // Retake rules
  @IsOptional()
  @IsInt()
  @Min(0)
  maxRetakes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  retakeCoolingHours?: number;

  @IsOptional()
  @IsString()
  @IsIn(['highest', 'latest', 'average'], { message: 'Score policy must be highest, latest, or average' })
  retakeScorePolicy?: string;
}
