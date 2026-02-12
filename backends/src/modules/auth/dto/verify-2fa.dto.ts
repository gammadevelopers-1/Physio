import { IsNotEmpty, IsString, Length } from 'class-validator';

export class Verify2FADto {
  @IsString()
  @IsNotEmpty()
  challengeId: string;

  @IsString()
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits' })
  code: string;
}
