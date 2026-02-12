import { IsBoolean } from 'class-validator';

export class Toggle2FADto {
  @IsBoolean()
  enabled: boolean;
}
