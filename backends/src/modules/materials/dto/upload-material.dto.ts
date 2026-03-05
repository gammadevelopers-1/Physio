import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsUUID,
  MaxLength,
  IsBooleanString,
} from 'class-validator';
import { MATERIAL_TYPE, MaterialType } from '../../../database/schema';

const validTypes = Object.values(MATERIAL_TYPE);

export class UploadMaterialDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Type is required' })
  @IsIn(validTypes, {
    message: `Type must be one of: ${validTypes.join(', ')}`,
  })
  type: MaterialType;

  @IsOptional()
  @IsUUID('4', { message: 'Module ID must be a valid UUID' })
  moduleId?: string;

  @IsOptional()
  @IsBooleanString({ message: 'autoTranscribe must be a boolean string' })
  autoTranscribe?: string;
}
