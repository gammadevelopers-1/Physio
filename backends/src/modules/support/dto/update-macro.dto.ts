import {
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class UpdateMacroDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  bodyTemplate?: string;

  // Pass null to clear an existing Arabic body, undefined to leave
  // it unchanged.
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  bodyAr?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoryKey?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  kbArticleUrls?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
