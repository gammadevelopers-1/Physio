import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsIn,
  IsOptional,
  MaxLength,
} from 'class-validator';

/**
 * Guest ticket creation — ONLY for login issues.
 * No authentication required. Category locked to 'login'.
 */
export class CreateGuestTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;

  @IsIn(['login'], {
    message: 'Guest tickets are only allowed for login issues',
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
}
