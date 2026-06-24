import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateTaxSettingsDto {
  @IsBoolean()
  vatEnabled!: boolean;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  vatRate!: number;

  @IsString()
  @MaxLength(50)
  taxNumber!: string;

  @IsString()
  @MaxLength(255)
  companyNameEn!: string;

  @IsString()
  @MaxLength(255)
  companyNameAr!: string;

  @IsIn(['standard', 'exempt', 'zero_rated'])
  defaultVatTreatment!: 'standard' | 'exempt' | 'zero_rated';
}
