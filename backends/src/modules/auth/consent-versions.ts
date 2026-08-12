/**
 * Current active document versions that users register their consent
 * against. Bump the relevant constant when Terms/Privacy substantially
 * change and re-acceptance is required.
 *
 * The `user_consents` table stores the version that was current at the
 * user's moment of acceptance — old rows are never rewritten, so this
 * constant only affects NEW consents from now on.
 *
 * Convention: ISO date of the change (YYYY-MM-DD). Semver is fine too if
 * a formal versioning process is later adopted — the column is varchar(32).
 */

export const CURRENT_TERMS_VERSION = '2026-08-12';
export const CURRENT_PRIVACY_VERSION = '2026-08-12';

export const CONSENT_TYPE = {
  TERMS: 'terms',
  PRIVACY: 'privacy',
  MARKETING_EMAIL: 'marketing_email',
} as const;

export type ConsentType = (typeof CONSENT_TYPE)[keyof typeof CONSENT_TYPE];
