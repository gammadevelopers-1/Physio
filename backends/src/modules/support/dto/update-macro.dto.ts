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
  bodyTemplate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variables?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  kbArticleUrls?: string[];

  @IsOptional()
  @IsUUID('4')
  escalationPathId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
