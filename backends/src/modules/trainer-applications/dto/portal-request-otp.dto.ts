import { IsEmail, IsOptional, IsString } from 'class-validator';

/**
 * Step 1 of the self-serve portal: applicant types their email; we
 * send an OTP to that mailbox so we know they own it before showing
 * their application status / accepting a resubmit.
 *
 * Mirrors RequestOtpDto in shape but the purpose under the hood is
 * `trainer-application-portal`, not `trainer-application` — so a
 * portal OTP can never be replayed to submit a brand-new application.
 */
export class PortalRequestOtpDto {
  @IsEmail({}, { message: 'Please provide a valid email' })
  email!: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
