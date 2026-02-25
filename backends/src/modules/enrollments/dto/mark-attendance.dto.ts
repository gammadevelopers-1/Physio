import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsIn,
  IsUUID,
  IsDateString,
  Min,
  MaxLength,
  ValidateIf,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import {
  ATTENDANCE_STATUS,
  AttendanceStatus,
} from '../../../database/schema';

const validStatuses = Object.values(ATTENDANCE_STATUS);

/** Custom validator: joinedAt must be before leftAt if both are provided */
@ValidatorConstraint({ name: 'joinedBeforeLeft', async: false })
class JoinedBeforeLeftConstraint implements ValidatorConstraintInterface {
  validate(_value: any, args: ValidationArguments) {
    const obj = args.object as any;
    if (obj.joinedAt && obj.leftAt) {
      return new Date(obj.joinedAt) < new Date(obj.leftAt);
    }
    return true;
  }

  defaultMessage() {
    return 'joinedAt must be before leftAt';
  }
}

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
  @Validate(JoinedBeforeLeftConstraint)
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
  @MaxLength(1000, { message: 'Note must not exceed 1000 characters' })
  note?: string;
}
