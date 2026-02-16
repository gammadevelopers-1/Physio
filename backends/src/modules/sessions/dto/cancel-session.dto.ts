import { IsString, IsNotEmpty } from 'class-validator';

export class CancelSessionDto {
  @IsString()
  @IsNotEmpty({ message: 'Cancel reason is required' })
  cancelReason: string;
}
