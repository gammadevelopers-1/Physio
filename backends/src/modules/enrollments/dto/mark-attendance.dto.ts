import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsIn,
  IsUUID,
  IsDateString,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  ATTENDANCE_STATUS,
  AttendanceStatus,
} from '../../../database/schema';

const validStatuses = Object.values(ATTENDANCE_STATUS);

export class MarkAttendanceDto {
  @IsUUID('4', { message: 'Student ID must be a valid UUID' })
  studentId: string;

  @IsString()
  @IsNotEmpty({ message: 'Status is required' })
  @IsIn(validStatuses, {
    message: `Status must be one of: ${validStatuses.join(', ')}`,
  })
  status: AttendanceStatus;

  @IsOptional()
  @IsDateString({}, { message: 'joinedAt must be a valid ISO date string' })
  joinedAt?: string;

  @IsOptional()
  @IsDateString({}, { message: 'leftAt must be a valid ISO date string' })
  leftAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMinutes?: number;

  @ValidateIf((o) => o.status === 'late' || o.status === 'excused')
  @IsNotEmpty({ message: 'Note is required for late or excused attendance' })
  @IsString()
  note?: string;
}
