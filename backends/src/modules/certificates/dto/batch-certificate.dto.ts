import {
  IsArray,
  IsString,
  IsOptional,
  IsIn,
  IsUUID,
  ArrayMinSize,
} from 'class-validator';

export class BatchCertificateDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one ID is required' })
  @IsUUID('4', { each: true, message: 'Each ID must be a valid UUID' })
  ids: string[];

  @IsString()
  @IsIn(['approve', 'reject', 'hold'], {
    message: 'Action must be one of: approve, reject, hold',
  })
  action: 'approve' | 'reject' | 'hold';

  @IsOptional()
  @IsString()
  note?: string;
}
