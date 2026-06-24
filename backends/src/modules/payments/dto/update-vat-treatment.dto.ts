import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsUUID,
} from 'class-validator';

export type VatTreatmentValue = 'standard' | 'exempt' | 'zero_rated';

export class UpdateVatTreatmentDto {
  @IsIn(['standard', 'exempt', 'zero_rated'])
  treatment!: VatTreatmentValue;
}

export class BulkUpdateVatTreatmentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  courseIds!: string[];

  @IsIn(['standard', 'exempt', 'zero_rated'])
  treatment!: VatTreatmentValue;
}
