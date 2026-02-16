import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsIn,
  MaxLength,
  Min,
} from 'class-validator';
import { MODULE_TYPE, ModuleType } from '../../../database/schema';

const validModuleTypes = Object.values(MODULE_TYPE);

export class CreateModuleDto {
  @IsString()
  @IsNotEmpty({ message: 'Module title is required' })
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  titleAr?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @IsString()
  @IsNotEmpty({ message: 'Module type is required' })
  @IsIn(validModuleTypes, {
    message: `Module type must be one of: ${validModuleTypes.join(', ')}`,
  })
  type: ModuleType;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMinutes?: number;
}
