import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsIn,
  IsUUID,
  IsBoolean,
  IsNumber,
  IsArray,
  MaxLength,
  Min,
  IsDateString,
} from 'class-validator';
import { DELIVERY_TYPE, DeliveryType } from '../../../database/schema';

export class RequestChangesDto {
  @IsString()
  @IsNotEmpty({ message: 'Review note is required' })
  @MaxLength(1000, { message: 'Review note must not exceed 1000 characters' })
  note: string;
}

const validDeliveryTypes = Object.values(DELIVERY_TYPE);

export class CreateCourseDto {
  @IsOptional()
  @IsUUID('4', { message: 'Instructor ID must be a valid UUID' })
  instructorId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Manager ID must be a valid UUID' })
  managerId?: string;

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
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cmeHours?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Enrollment deadline must be a valid date string' })
  enrollmentDeadline?: string;

  @IsOptional()
  @IsBoolean()
  isCmeAccredited?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['en', 'ar', 'both'])
  language?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Start date must be a valid date string (YYYY-MM-DD)' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid date string (YYYY-MM-DD)' })
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cohort?: string;

  // Course content fields
  @IsOptional()
  @IsString()
  overview?: string;

  @IsOptional()
  @IsString()
  overviewAr?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objectives?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objectivesAr?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featuresAr?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetAudience?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetAudienceAr?: string[];

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsString()
  requirementsAr?: string;

  @IsOptional()
  @IsString()
  notices?: string;

  @IsOptional()
  @IsString()
  noticesAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  venue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  venueAr?: string;

  @IsOptional()
  @IsBoolean()
  showContents?: boolean;
}
