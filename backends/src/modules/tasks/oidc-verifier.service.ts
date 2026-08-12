import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

/**
 * Verifies Google-signed OIDC ID tokens that Cloud Tasks attaches to
 * every dispatched HTTP request. This is our sole authentication for
 * POST /internal/tasks/dispatch — no shared secrets, no static tokens.
 *
 * How Cloud Tasks signs the request:
 *   1. Task carries `oidcToken: { serviceAccountEmail, audience }`.
 *   2. At dispatch time, Cloud Tasks mints a fresh JWT signed by
 *      Google, with `email: serviceAccountEmail`, `aud: audience`.
 *   3. The JWT is sent as `Authorization: Bearer <token>`.
 *
 * What we verify:
 *   - Signature valid (against Google's public JWKs)
 *   - `aud` == our configured audience (protects against token reuse
 *     across services)
 *   - `email` matches our allow-list (only the dispatcher SA can call us)
 *   - `email_verified` is true
 *
 * OAuth2Client caches Google's JWKs internally, so repeated verifies
 * are fast (one network call every ~6h to refresh keys).
 */
@Injectable()
export class OidcVerifierService {
  private readonly logger = new Logger(OidcVerifierService.name);
  private readonly client = new OAuth2Client();
  private readonly expectedAudience: string;
  private readonly allowedServiceAccounts: Set<string>;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = this.config.get<string>('TASKS_ENABLED', 'true') !== 'false';
    this.expectedAudience = this.config.get<string>('TASKS_OIDC_AUDIENCE', '');

    const dispatcher = this.config.get<string>('TASKS_DISPATCHER_SA', '');
    // Allow a comma-separated list so ops can add extra callers (e.g.
    // Cloud Scheduler → dispatch for boundary-triggered events) without
    // a code change.
    const extra = this.config
      .get<string>('TASKS_ALLOWED_INVOKERS', '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    this.allowedServiceAccounts = new Set([dispatcher, ...extra].filter(Boolean));

    if (this.enabled && (!this.expectedAudience || this.allowedServiceAccounts.size === 0)) {
      this.logger.error(
        'OidcVerifierService misconfigured — TASKS_OIDC_AUDIENCE and TASKS_DISPATCHER_SA must be set when TASKS_ENABLED != false.',
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Verifies the token from an Authorization header. Throws
   * UnauthorizedException on any failure. Returns the verified
   * service-account email on success.
   *
   * Header format: `Authorization: Bearer <jwt>`.
   */
  async verifyBearer(authHeader: string | undefined): Promise<string> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Empty bearer token');
    }

    let ticket;
    try {
      ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: this.expectedAudience,
      });
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      this.logger.warn(`OIDC verify failed: ${errorObj.message}`);
      throw new UnauthorizedException('Invalid OIDC token');
    }

    const payload = ticket.getPayload();
    if (!payload) {
      throw new UnauthorizedException('OIDC token has no payload');
    }
    if (!payload.email || payload.email_verified === false) {
      throw new UnauthorizedException('OIDC token missing or unverified email');
    }
    if (!this.allowedServiceAccounts.has(payload.email)) {
      this.logger.warn(
        `OIDC token from unexpected SA: ${payload.email} (expected one of: ${Array.from(
          this.allowedServiceAccounts,
        ).join(', ')})`,
      );
      throw new UnauthorizedException('Caller not authorised');
    }

    return payload.email;
  }
}
