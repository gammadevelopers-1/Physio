import { IsEmail, IsOptional, IsString } from 'class-validator';

export class RequestOtpDto {
  @IsEmail({}, { message: 'Please provide a valid email' })
  email: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;

  @IsOptional()
  @IsString()
  locale?: string;
}
