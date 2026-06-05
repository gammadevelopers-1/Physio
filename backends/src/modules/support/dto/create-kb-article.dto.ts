import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateKbArticleDto {
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

  // Free-form slug — must reference a row in kb_categories. The service
  // layer validates that the slug actually exists; we no longer pin the
  // list of allowed values in the DTO because admins can add categories.
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  category: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
