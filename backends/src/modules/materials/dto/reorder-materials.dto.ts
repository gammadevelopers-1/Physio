import { IsArray, IsUUID } from 'class-validator';

export class ReorderMaterialsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  materialIds: string[];
}
