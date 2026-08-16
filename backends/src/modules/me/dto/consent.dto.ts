import { IsBoolean, IsIn, IsNotEmpty, IsString } from 'class-validator';

/**
 * Type union covers all consent types the API accepts (base three from
 * consent-versions.ts + `sensitive_data` for medical qualifications /
 * national ID storage explicit opt-in). Kept as a plain list so the DTO
 * validator can reject anything else at request boundary.
 */
export const ACCEPTED_CONSENT_TYPES = [
  'terms',
  'privacy',
  'marketing_email',
  'sensitive_data',
] as const;

export type AcceptedConsentType = (typeof ACCEPTED_CONSENT_TYPES)[number];

export class GrantConsentDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(ACCEPTED_CONSENT_TYPES as unknown as string[])
  type!: AcceptedConsentType;
}

export class WithdrawConsentDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(ACCEPTED_CONSENT_TYPES as unknown as string[])
  type!: AcceptedConsentType;
}

export class SetMarketingConsentDto {
  @IsBoolean()
  enabled!: boolean;
}
