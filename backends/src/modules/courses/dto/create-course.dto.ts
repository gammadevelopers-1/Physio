import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsIn,
  IsUUID,
  MaxLength,
  Min,
  IsDateString,
} from 'class-validator';
import { DELIVERY_TYPE, DeliveryType } from '../../../database/schema';

const validDeliveryTypes = Object.values(DELIVERY_TYPE);

export class CreateCourseDto {
  @IsOptional()
  @IsUUID('4', { message: 'Instructor ID must be a valid UUID' })
  instructorId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(255)
  title: string;

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

  @IsString()
  @IsNotEmpty({ message: 'Delivery type is required' })
  @IsIn(validDeliveryTypes, {
    message: `Delivery type must be one of: ${validDeliveryTypes.join(', ')}`,
  })
  deliveryType: DeliveryType;

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
