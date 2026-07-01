import { registerAs } from '@nestjs/config';

/**
 * NELC LRS (Learning Record Store) configuration.
 *
 * Every learner-journey event (login, enrolment, lesson watch, assessment,
 * certificate, etc.) is sent as an xAPI 1.0.3 statement to NELC's LRS at
 * the endpoint below. NELC validates by replaying the statement stream
 * against the learner's Saudi national ID.
 *
 * Credentials are issued by NELC per platform — staging is provisioned at
 * onboarding, production credentials follow once staging validation passes.
 *
 * When NELC_LRS_ENABLED is false (default), XapiService.emit() short-
 * circuits to a logger.debug() so local dev never accidentally POSTs to
 * NELC's staging endpoint.
 */
export default registerAs('nelc', () => ({
  enabled: process.env.NELC_LRS_ENABLED === 'true',

  // ── Mode + per-environment endpoints/passwords ──────────────────────
  // Active mode is resolved at request time by NelcModeService:
  //   1. system_settings.nelc.mode (admin toggle in the UI)
  //   2. NELC_LRS_MODE env var (this default)
  //   3. 'staging' (fail-safe)
  // Username is the same across both envs per NELC's provisioning.
  defaultMode: (process.env.NELC_LRS_MODE === 'production'
    ? 'production'
    : 'staging') as 'staging' | 'production',
  endpointStaging:
    process.env.NELC_LRS_ENDPOINT_STAGING ||
    process.env.NELC_LRS_ENDPOINT ||
    'https://lrs.nelc.gov.sa/lrs-license-stg/xapi/statements',
  endpointProd:
    process.env.NELC_LRS_ENDPOINT_PROD ||
    'https://lrs.nelc.gov.sa/lrs-nelc/xapi/statements',
  username: process.env.NELC_LRS_USERNAME || '',
  // Both passwords are already base64-encoded by NELC (they hand us the
  // encoded string, not the plaintext). HTTP Basic auth then base64-
  // encodes "username:password" again — that's the spec, not a double-
  // encode bug.
  passwordStaging: process.env.NELC_LRS_PASSWORD || '',
  passwordProd: process.env.NELC_LRS_PASSWORD_PROD || '',

  // ── Legacy single-env shims (still read by getConfig + a couple of
  //    log lines; safe to remove after the next release cycle) ────────
  endpoint:
    process.env.NELC_LRS_ENDPOINT ||
    'https://lrs.nelc.gov.sa/lrs-license-stg/xapi/statements',
  password: process.env.NELC_LRS_PASSWORD || '',

  // The identifier NELC matches against. For PhysioGuidance, the full
  // platform URL (what they gave us in the staging credentials file).
  // Sent as `context.platform` on every statement.
  platformIdentifier:
    process.env.NELC_PLATFORM_IDENTIFIER || 'https://physioguidance.org/',

  // Bilingual platform name sent in the NELC custom extension
  // https://nelc.gov.sa/extensions/platform — { name: { ar-SA, en-US } }
  platformNameEn: process.env.NELC_PLATFORM_NAME_EN || 'PhysioGuidance',
  platformNameAr: process.env.NELC_PLATFORM_NAME_AR || 'فيزيو جايدنس',

  // Base URL for the canonical activity IDs we generate (e.g.
  // {lmsUrl}/courses/<id>). NELC may dereference these, so it should be
  // the public production URL — even in staging — to avoid 404s on their
  // side. Defaults to platformIdentifier for safety.
  lmsUrl:
    process.env.NELC_LMS_URL ||
    process.env.NELC_PLATFORM_IDENTIFIER ||
    'https://physioguidance.org',

  // Per-request timeout for LRS POSTs. NELC's staging has been seen to
  // take a few seconds on cold paths; 15s is generous without blocking
  // the queue worker indefinitely.
  timeoutMs: Number(process.env.NELC_LRS_TIMEOUT_MS) || 15_000,

  // Max retries per statement before status flips to 'failed'. Cron
  // flush re-picks failed rows on the next hourly tick regardless.
  maxAttempts: Number(process.env.NELC_LRS_MAX_ATTEMPTS) || 3,
}));
