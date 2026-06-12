import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateMacroDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  bodyTemplate: string;

  // Optional Arabic body. When omitted, applyMacro falls back to the
  // English bodyTemplate regardless of the request locale.
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  bodyAr?: string;

  // Ticket-category slug this macro is for (e.g. 'login', 'billing').
  // Free-form because categories are admin-extensible — validation
  // happens against the live category list at the service layer.
  // Empty/null = general-purpose, shows in every ticket's dropdown.
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
}
