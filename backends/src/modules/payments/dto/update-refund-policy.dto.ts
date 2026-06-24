import {
  IsBoolean,
  IsNumber,
  IsObject,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class RefundPolicyRulesDto {
  @IsBoolean()
  blockAfterCourseStart!: boolean;

  @IsBoolean()
  blockAfterAttendance!: boolean;

  @IsBoolean()
  blockAfterCertificate!: boolean;

  @IsBoolean()
  blockAfterCmeGranted!: boolean;
}

class PerGatewaySettingsDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  deductionPercent!: number;

  @IsBoolean()
  partialRefundCapable!: boolean;
}

class PerGatewayMapDto {
  @ValidateNested() @Type(() => PerGatewaySettingsDto)
  moyasar!: PerGatewaySettingsDto;

  @ValidateNested() @Type(() => PerGatewaySettingsDto)
  tamara!: PerGatewaySettingsDto;

  @ValidateNested() @Type(() => PerGatewaySettingsDto)
  tabby!: PerGatewaySettingsDto;

  @ValidateNested() @Type(() => PerGatewaySettingsDto)
  bank_transfer!: PerGatewaySettingsDto;

  @ValidateNested() @Type(() => PerGatewaySettingsDto)
  mock!: PerGatewaySettingsDto;
}

export class UpdateRefundPolicyDto {
  @ValidateNested() @Type(() => RefundPolicyRulesDto)
  rules!: RefundPolicyRulesDto;

  @IsBoolean()
  autoApproveEligible!: boolean;

  @IsObject()
  @ValidateNested() @Type(() => PerGatewayMapDto)
  perGateway!: PerGatewayMapDto;
}
