import {
  IsString,
  IsOptional,
  IsIn,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MATERIAL_TYPE, MaterialType } from '../../../database/schema';

const validTypes = Object.values(MATERIAL_TYPE);

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @IsIn(validTypes, {
    message: `Type must be one of: ${validTypes.join(', ')}`,
  })
  type?: MaterialType;

  @IsOptional()
  @IsUUID('4', { message: 'Module ID must be a valid UUID' })
  moduleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  wcagStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  captionsUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  transcriptUrl?: string;
}
