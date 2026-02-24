import { IsString, IsNotEmpty } from 'class-validator';

export class RevokeCertificateDto {
  @IsString()
  @IsNotEmpty({ message: 'A revocation reason is required' })
  reason: string;
}
