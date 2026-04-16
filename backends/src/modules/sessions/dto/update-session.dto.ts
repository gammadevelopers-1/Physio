import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { SESSION_TYPE, SessionType } from '../../../database/schema';

const validSessionTypes = Object.values(SESSION_TYPE);

export class UpdateSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @IsIn(validSessionTypes, {
    message: `Type must be one of: ${validSessionTypes.join(', ')}`,
  })
  type?: SessionType;

  @IsOptional()
  @IsDateString({}, { message: 'scheduledAt must be a valid ISO date string' })
  scheduledAt?: string;

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
  @MaxLength(100)
  city?: string;
}
