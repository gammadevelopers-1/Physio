import { IsEmail, IsOptional, ValidateIf } from 'class-validator';

export class UpdateZoomConfigDto {
  /**
   * Default fallback host email. Empty string / null clears it (revert to
   * the OAuth app owner). When non-empty it must be a valid email.
   */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsEmail({}, { message: 'defaultHostEmail must be a valid email' })
  defaultHostEmail?: string | null;
}

export class TestZoomConnectionDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsEmail({}, { message: 'email must be a valid email' })
  email?: string;
}
