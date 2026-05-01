import { IsOptional, IsString, MinLength } from 'class-validator';

export class CompletePasswordSetupDto {
  @IsString()
  @MinLength(32, { message: 'Invalid token' })
  token: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}
