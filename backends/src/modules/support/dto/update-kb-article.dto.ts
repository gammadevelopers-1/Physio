import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class UpdateKbArticleDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  titleEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  titleAr?: string;

  @IsOptional()
  @IsString()
  bodyEn?: string;

  @IsOptional()
  @IsString()
  bodyAr?: string;

  // Free-form slug — validated against kb_categories in the service.
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
