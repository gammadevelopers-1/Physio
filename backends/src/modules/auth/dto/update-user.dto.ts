import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsIn,
  IsEmail,
  ValidateIf,
} from 'class-validator';
import { ROLE_NAMES } from '../../../database/schema';

const validRoles = Object.values(ROLE_NAMES);

export class UpdateUserDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  /**
   * The instructor's Zoom seat email — the licensed user under which
   * their sessions/webinars are hosted. Empty string clears it (falls
   * back to login email, then the default host). When set it must be a
   * valid email.
   */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsEmail({}, { message: 'zoomEmail must be a valid email' })
  zoomEmail?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional()
  @IsIn(validRoles, { message: `Role must be one of: ${validRoles.join(', ')}` })
  activeRole?: string;
}
