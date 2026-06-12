import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsIn,
  IsOptional,
  MaxLength,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';

/**
 * Guest ticket creation — public, unauthenticated.
 * Category is restricted to the small set of guest-allowed values:
 *   - 'login'    Login / OTP issues
 *   - 'trainer'  Become-a-trainer applicants asking about their submission
 *                (the public form surfaces this option; agents see the
 *                applicant's application status in the ticket card).
 */
export class CreateGuestTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;

  @IsIn(['login', 'trainer'], {
    message: 'Guest tickets are only allowed for login or trainer-application issues',
  })
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  /**
   * Google reCAPTCHA v2 token captured by the public form. The server
   * verifies this against Google's siteverify endpoint before creating
   * the ticket. Required when reCAPTCHA is configured for the site; if
   * `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` / server secret are unset the
   * server skips verification (mirrors the signin/signup pattern).
   */
  @IsOptional()
  @IsString()
  recaptchaToken?: string;

  // Optional multi-attachment for the public form. Same validator path
  // as the authenticated DTO — capped at 10 files, each URL must come
  // from our storage origin.
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  attachmentUrls?: string[];
}
