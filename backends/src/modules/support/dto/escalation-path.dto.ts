import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsBoolean,
  MaxLength,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EscalationStepDto {
  @IsNumber()
  @Min(1)
  afterMinutes: number;

  @IsString()
  @IsNotEmpty()
  assignToRole: string;
}

export class CreateEscalationPathDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EscalationStepDto)
  steps: EscalationStepDto[];
}

export class UpdateEscalationPathDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EscalationStepDto)
  steps?: EscalationStepDto[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
