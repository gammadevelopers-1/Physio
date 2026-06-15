import { IsString } from 'class-validator';

export class RejectRefundDto {
  @IsString()
  rejectionNote: string;
}
