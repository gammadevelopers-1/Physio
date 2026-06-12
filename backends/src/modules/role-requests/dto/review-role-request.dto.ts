import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsIn,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MISSING_REQUIREMENT_CODES } from '../../../database/schema';

/**
 * One structured "what's missing" entry. `code` picks from the fixed
 * enum; `label` is required when code === 'OTHER' (free-text label),
 * optional otherwise (overrides the default label). `note` is an
 * optional admin comment targeted at this requirement.
 */
export class MissingRequirementDto {
  @IsIn([...MISSING_REQUIREMENT_CODES])
  code!: (typeof MISSING_REQUIREMENT_CODES)[number];

  @ValidateIf((o) => o.code === 'OTHER')
  @IsString()
  @IsNotEmpty({ message: "label is required when code is 'OTHER'" })
  label?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ReviewRoleRequestDto {
  @IsOptional()
  @IsString()
  reviewNote?: string;

  @IsOptional()
  @IsBoolean()
  blockNationalId?: boolean;

  /**
   * Structured "what's missing" list — only meaningful for
   * requestInfo() but accepted on the shared DTO so the validator
   * pipeline is uniform across actions.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MissingRequirementDto)
  missingRequirements?: MissingRequirementDto[];
}
