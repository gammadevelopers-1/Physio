import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsIn,
  IsUUID,
  IsDateString,
  IsBoolean,
  MaxLength,
  Min,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';
import { SESSION_TYPE, SessionType } from '../../../database/schema';

const validSessionTypes = Object.values(SESSION_TYPE);

@ValidatorConstraint({ name: 'isFutureDate', async: false })
class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(dateString: string) {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && date > new Date();
  }
  defaultMessage() {
    return 'scheduledAt must be a future date';
  }
}

export class CreateSessionDto {
  @IsOptional()
  @IsUUID('4', { message: 'Instructor ID must be a valid UUID' })
  instructorId?: string;

  @IsUUID('4', { message: 'Course ID must be a valid UUID' })
  courseId: string;

  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Type is required' })
  @IsIn(validSessionTypes, {
    message: `Type must be one of: ${validSessionTypes.join(', ')}`,
  })
  type: SessionType;

  @IsDateString({}, { message: 'scheduledAt must be a valid ISO date string' })
  @Validate(IsFutureDateConstraint)
  scheduledAt: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  zoomLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  meetingId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  roomName?: string;

  @IsOptional()
  @IsString()
  venueAddress?: string;

  @IsOptional()
  @IsString()
  localDate?: string;

  @IsOptional()
  @IsBoolean()
  recordingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isMakeup?: boolean;

  @IsOptional()
  @IsUUID('4')
  parentSessionId?: string;

  @IsOptional()
  @IsUUID('4', { each: true })
  assignedStudents?: string[];
}
