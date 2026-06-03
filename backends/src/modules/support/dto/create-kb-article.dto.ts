import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
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

  @IsIn(['billing', 'login', 'content', 'certificate', 'technical', 'other'])
  @IsNotEmpty()
  category: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
