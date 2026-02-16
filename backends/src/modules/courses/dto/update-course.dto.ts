import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  MaxLength,
  Min,
  IsDateString,
} from 'class-validator';
import {
  DELIVERY_TYPE,
  DeliveryType,
  COURSE_STATUS,
  CourseStatus,
} from '../../../database/schema';

const validDeliveryTypes = Object.values(DELIVERY_TYPE);
const validStatuses = Object.values(COURSE_STATUS);

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  titleAr?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  @IsIn(validDeliveryTypes, {
    message: `Delivery type must be one of: ${validDeliveryTypes.join(', ')}`,
  })
  deliveryType?: DeliveryType;

  @IsOptional()
  @IsString()
  @IsIn(validStatuses, {
    message: `Status must be one of: ${validStatuses.join(', ')}`,
  })
  status?: CourseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnail?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxEnrollment?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Start date must be a valid date string (YYYY-MM-DD)' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid date string (YYYY-MM-DD)' })
  endDate?: string;
}
