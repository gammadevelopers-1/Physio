import { IsString, IsNotEmpty } from 'class-validator';

export class RejectCertificateDto {
  @IsString()
  @IsNotEmpty({ message: 'A rejection note is required' })
  note: string;
}
