import { Type } from 'class-transformer';
import {
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { MarkAttendanceDto } from './mark-attendance.dto';

export class BulkMarkAttendanceDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one attendance record is required' })
  @ValidateNested({ each: true })
  @Type(() => MarkAttendanceDto)
  records: MarkAttendanceDto[];
}
