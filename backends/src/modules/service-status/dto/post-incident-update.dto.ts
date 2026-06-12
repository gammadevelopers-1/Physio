import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { INCIDENT_STATUS_VALUES } from './create-incident.dto';

export class PostIncidentUpdateDto {
  @IsIn(INCIDENT_STATUS_VALUES)
  status: (typeof INCIDENT_STATUS_VALUES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  messageEn: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  messageAr?: string;
}
