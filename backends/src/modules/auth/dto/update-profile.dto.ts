import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { IsSaudiNationalId } from '../../../common/validators/saudi-national-id.validator';
import { IsSaudiPhone } from '../../../common/validators/saudi-phone.validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  lastName?: string;

  // Empty string is the "clear my phone" sentinel — allowed through
  // without format validation. Any non-empty value must be a valid KSA
  // mobile (will be normalized to E.164 in the service before encrypt).
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @ValidateIf((o) => typeof o.phone === 'string' && o.phone.length > 0)
  @IsSaudiPhone()
  phone?: string;

  @IsOptional()
  @ValidateIf((o) => o.avatar !== null)
  @IsString()
  @MaxLength(500)
  avatar?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstNameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastNameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  scfhsNumber?: string;

  // National ID / Iqama — KSA-validated. The service-layer one-time-set
  // guard (see updateProfile in auth.service.ts) rejects any attempt to
  // change this once the user already has a value.
  @IsOptional()
  @IsString()
  @IsSaudiNationalId({ message: 'Invalid Saudi National ID / Iqama number' })
  nationalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  dateOfBirth?: string;

  // Instructor profile fields (also editable by other roles, harmless if blank)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  profession?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  qualification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  twitter?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkedin?: string;
}
