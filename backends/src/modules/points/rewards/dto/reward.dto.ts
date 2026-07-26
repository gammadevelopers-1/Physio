import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { REWARD_TYPES, type RewardType } from '../../../../database/schema';

export class CreateRewardDto {
  @IsString()
  @MinLength(2)
  nameEn!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsIn([...REWARD_TYPES])
  type!: RewardType;

  @IsInt()
  @Min(1)
  pointsCost!: number;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerUser?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalStock?: number | null;

  @IsOptional()
  @IsISO8601()
  validFrom?: string | null;

  @IsOptional()
  @IsISO8601()
  validUntil?: string | null;
}

export class UpdateRewardDto {
  @IsOptional() @IsString() @MinLength(2) nameEn?: string;
  @IsOptional() @IsString() nameAr?: string;
  @IsOptional() @IsString() descriptionEn?: string;
  @IsOptional() @IsString() descriptionAr?: string;
  @IsOptional() @IsInt() @Min(1) pointsCost?: number;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() displayOrder?: number;
  @IsOptional() @IsInt() @Min(1) maxPerUser?: number | null;
  @IsOptional() @IsInt() @Min(0) totalStock?: number | null;
  @IsOptional() @IsISO8601() validFrom?: string | null;
  @IsOptional() @IsISO8601() validUntil?: string | null;
}

export class TransitionArtifactDto {
  @IsIn(['code', 'link', 'note'])
  kind!: 'code' | 'link' | 'note';

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  value!: string;
}

/**
 * Phase 2: transitions are described by the target `status`. For
 * `status === 'fulfilled'` on an `other`-type reward the admin MUST include
 * the fulfillment `artifact` (code / link / note). `adminNote` is optional
 * and — when present on a fulfillment — is stored under artifact.meta.note.
 *
 * `reason` is used by `failed` / `reversed` transitions (audit trail on the
 * refund entry and the reversal_reason column).
 */
export class TransitionRedemptionDto {
  @IsIn(['fulfilled', 'failed', 'reversed'])
  status!: 'fulfilled' | 'failed' | 'reversed';

  @IsOptional()
  @ValidateNested()
  @Type(() => TransitionArtifactDto)
  artifact?: TransitionArtifactDto;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

/**
 * Optional body on `POST /points/me/rewards/:id/redeem`. Only meaningful
 * for reward types that ask the student to pick from a set at redeem
 * time (currently `free_course` when the reward bundles more than one
 * course). For every other reward type these fields are ignored.
 */
export class RedeemRewardDto {
  @IsOptional()
  @IsUUID()
  selectedCourseId?: string;

  @IsOptional()
  @IsString()
  selectedDeliveryType?: string;
}
