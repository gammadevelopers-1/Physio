import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  IsIn,
} from 'class-validator';
import { ROLE_NAMES, SUPPORT_SUB_ROLES } from '../../../database/schema';

// SUPER_ADMIN is seed-only — never assignable via API
const validRoles = Object.values(ROLE_NAMES).filter(
  (r) => r !== ROLE_NAMES.SUPER_ADMIN,
);

const validSubRoles = Object.values(SUPPORT_SUB_ROLES);

export class CreateUserDto {
  @IsEmail({}, { message: 'Please provide a valid email' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
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
  phone?: string;

  @IsIn(validRoles, { message: `Role must be one of: ${validRoles.join(', ')}` })
  role: string;

  @IsOptional()
  @IsIn(validSubRoles, {
    message: `Support sub-role must be one of: ${validSubRoles.join(', ')}`,
  })
  supportSubRole?: string;
}
