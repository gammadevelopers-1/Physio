import {
  IsArray,
  ValidateNested,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ModuleOrderItem {
  @IsUUID('4', { message: 'Module ID must be a valid UUID' })
  id: string;

  @IsInt()
  @Min(0)
  orderIndex: number;
}

export class ReorderModulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleOrderItem)
  modules: ModuleOrderItem[];
}
