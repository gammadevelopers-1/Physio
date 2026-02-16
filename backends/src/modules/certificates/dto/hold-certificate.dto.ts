import { IsString, IsNotEmpty } from 'class-validator';

export class HoldCertificateDto {
  @IsString()
  @IsNotEmpty({ message: 'An audit note is required when holding' })
  note: string;
}
