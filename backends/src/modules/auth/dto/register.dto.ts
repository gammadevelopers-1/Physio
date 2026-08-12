import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches, IsNotEmpty, IsBoolean, Equals } from 'class-validator';
import { IsSaudiNationalId } from '../../../common/validators/saudi-national-id.validator';
import { IsSaudiPhone } from '../../../common/validators/saudi-phone.validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @IsSaudiPhone()
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  scfhsNumber?: string;

  // National ID / Iqama — required at student registration.
  // Validated as a 10-digit KSA ID with Luhn-style checksum. Once set,
  // the user cannot change it via update-profile (one-time field).
  @IsString()
  @IsNotEmpty({ message: 'National ID / Iqama is required' })
  @IsSaudiNationalId({ message: 'Invalid Saudi National ID / Iqama number' })
  nationalId: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;

  // PDPL consent — user must check "I accept Terms & Privacy Policy" at
  // sign-up. Recorded in user_consents against the CURRENT_TERMS_VERSION /
  // CURRENT_PRIVACY_VERSION constants at the moment of registration.
  @IsBoolean()
  @Equals(true, { message: 'You must accept the Terms of Service and Privacy Policy to register' })
  termsAccepted: boolean;

  // Optional marketing opt-in. Absent = no consent recorded (never assumed).
  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;
}
