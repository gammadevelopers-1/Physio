import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsIn,
  IsUUID,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { SESSION_TYPE, SessionType } from '../../../database/schema';

const validSessionTypes = Object.values(SESSION_TYPE);

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
}
