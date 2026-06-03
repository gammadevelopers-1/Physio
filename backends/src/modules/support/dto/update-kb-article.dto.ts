import {
  IsString,
  IsOptional,
  IsIn,
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

  @IsOptional()
  @IsIn(['billing', 'login', 'content', 'certificate', 'technical', 'other'])
  category?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
