import { IsEmail, IsString, Length } from 'class-validator';

/**
 * Step 2 of the self-serve portal: verify the OTP. On success the
 * service returns a short-lived scoped JWT with purpose
 * `trainer-application-portal` plus the applicant's current status
 * snapshot. The same JWT authorises a resubmit.
 */
export class PortalVerifyOtpDto {
  @IsEmail({}, { message: 'Please provide a valid email' })
  email!: string;

  @IsString()
  @Length(6, 6, { message: 'Code must be 6 digits' })
  code!: string;
}
