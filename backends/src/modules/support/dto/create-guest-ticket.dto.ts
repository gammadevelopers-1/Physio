import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsIn,
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
}
