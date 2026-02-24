import { IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';

export class UpdateUiPrefsDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  theme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  dateFormat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  timeFormat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  defaultView?: string;

  @IsOptional()
  @IsBoolean()
  compactMode?: boolean;

  @IsOptional()
  @IsBoolean()
  showTips?: boolean;

  @IsOptional()
  @IsBoolean()
  highContrast?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  fontSize?: string;

  @IsOptional()
  @IsBoolean()
  reduceMotion?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  contentLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  calendarFormat?: string;

  @IsOptional()
  @IsBoolean()
  captionsDefault?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  subtitlesLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  profileVisibility?: string;

  @IsOptional()
  @IsBoolean()
  dataSharing?: boolean;
}
