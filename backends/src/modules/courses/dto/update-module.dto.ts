import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  MaxLength,
  Min,
} from 'class-validator';
import { MODULE_TYPE, ModuleType } from '../../../database/schema';

const validModuleTypes = Object.values(MODULE_TYPE);

export class UpdateModuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  titleAr?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @IsOptional()
  @IsString()
  @IsIn(validModuleTypes, {
    message: `Module type must be one of: ${validModuleTypes.join(', ')}`,
  })
  type?: ModuleType;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMinutes?: number;
}
