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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DELIVERY_TYPE, DeliveryType } from '../../../database/schema';

export class RequestChangesDto {
  @IsString()
  @IsNotEmpty({ message: 'Review note is required' })
  @MaxLength(1000, { message: 'Review note must not exceed 1000 characters' })
  note: string;
}

export class FaqItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  question?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  questionAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  answer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  answerAr?: string;
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

  // NOTE: course-level sales are managed by the finance dashboard, not here.
  // See SetCourseSaleDto + DiscountsController (course-sales routes).

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

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accreditationNumber?: string;

  // Stored verbatim — no @IsUrl() because the client explicitly does
  // NOT want the link blocked or transformed.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  nelcReviewLink?: string;

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

  // Bilingual FAQ items — rendered only for zoom courses on the student
  // course detail page. Items missing both EN and AR question are filtered
  // out server-side before write.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaqItemDto)
  faqs?: FaqItemDto[];

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

  // Webinar Course only — when true, the recording is surfaced in enrolled
  // students' dashboards after Zoom finishes processing it. Default false.
  @IsOptional()
  @IsBoolean()
  recordingShareEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectionsOrder?: string[];

  @IsOptional()
  @IsBoolean()
  visibleOnPublicSite?: boolean;

  // Per-course SEO overrides. Empty values fall back to title /
  // description / thumbnail in the metadata helper.
  @IsOptional()
  @IsString()
  @MaxLength(150)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoKeywords?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoOgImage?: string;

  @IsOptional()
  @IsBoolean()
  seoNoindex?: boolean;
}
