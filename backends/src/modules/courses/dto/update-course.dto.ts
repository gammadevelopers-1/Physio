import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsBoolean,
  IsNumber,
  IsArray,
  MaxLength,
  Min,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DELIVERY_TYPE,
  DeliveryType,
} from '../../../database/schema';
import { FaqItemDto } from './create-course.dto';

const validDeliveryTypes = Object.values(DELIVERY_TYPE);

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

  // Course-level assessment defaults
  @IsOptional()
  @IsBoolean()
  assessmentProctoringEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  assessmentTimeLimitEnforced?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  assessmentMaxRetakes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  assessmentRetakeCoolingHours?: number;

  @IsOptional()
  @IsString()
  @IsIn(['highest', 'latest', 'average'])
  assessmentRetakeScorePolicy?: string;

  @IsOptional()
  @IsString()
  @IsIn(['full', 'failed_sections'])
  assessmentRetakeScope?: string;

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
