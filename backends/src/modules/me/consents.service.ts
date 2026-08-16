import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../../database';
import { userConsents } from '../../database/schema/user-consents';
import {
  CONSENT_TYPE,
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  ConsentType,
} from '../auth/consent-versions';
import { AuditLogService } from '../audit-logs/audit-logs.service';

/**
 * PDPL — Consent Management + Withdrawal + Marketing Control.
 *
 * All consent state changes are append-only: withdrawing marketing means
 * setting `withdrawnAt` on the active row (never deletion) and inserting
 * a new "withdrawal" audit trail entry. Regulators need the full history
 * to prove the user actually opted out on date X, not just that they are
 * currently opted out.
 */
@Injectable()
export class ConsentsService {
  private readonly logger = new Logger(ConsentsService.name);

  private static readonly VERSION_BY_TYPE: Record<string, string> = {
    [CONSENT_TYPE.TERMS]: CURRENT_TERMS_VERSION,
    [CONSENT_TYPE.PRIVACY]: CURRENT_PRIVACY_VERSION,
    [CONSENT_TYPE.MARKETING_EMAIL]: CURRENT_TERMS_VERSION,
    'sensitive_data': CURRENT_PRIVACY_VERSION,
  };

  constructor(private readonly auditLog: AuditLogService) {}

  /**
   * Full history of consent actions for this user, plus a computed
   * `currentStatus` per known type so the client can render toggles
   * without having to interpret the raw ledger.
   */
  async listMyConsents(userId: string): Promise<{
    history: Array<{
      type: string;
      version: string;
      acceptedAt: string;
      withdrawnAt: string | null;
    }>;
    currentStatus: Record<string, {
      granted: boolean;
      version: string | null;
      acceptedAt: string | null;
      withdrawnAt: string | null;
    }>;
  }> {
    const rows = await db
      .select()
      .from(userConsents)
      .where(eq(userConsents.userId, userId))
      .orderBy(desc(userConsents.acceptedAt));

    const history = rows.map((r) => ({
      type: r.consentType,
      version: r.version,
      acceptedAt: r.acceptedAt.toISOString(),
      withdrawnAt: r.withdrawnAt ? r.withdrawnAt.toISOString() : null,
    }));

    const knownTypes = Object.values(CONSENT_TYPE);
    const currentStatus: Record<string, {
      granted: boolean;
      version: string | null;
      acceptedAt: string | null;
      withdrawnAt: string | null;
    }> = {};

    for (const type of knownTypes) {
      // Most recent row for this consent type wins.
      const latest = rows.find((r) => r.consentType === type);
      if (!latest) {
        currentStatus[type] = {
          granted: false,
          version: null,
          acceptedAt: null,
          withdrawnAt: null,
        };
        continue;
      }
      currentStatus[type] = {
        granted: latest.withdrawnAt == null,
        version: latest.version,
        acceptedAt: latest.acceptedAt.toISOString(),
        withdrawnAt: latest.withdrawnAt
          ? latest.withdrawnAt.toISOString()
          : null,
      };
    }

    return { history, currentStatus };
  }

  /**
   * Grant a consent. Creates a new row rather than mutating an old one —
   * so a re-acceptance after Terms bump is a distinct ledger entry.
   * Terms/Privacy are considered mandatory and re-granting them is only
   * meaningful when the version has changed; marketing is opt-in and can
   * be toggled freely.
   */
  async grantConsent(
    userId: string,
    type: ConsentType | 'sensitive_data',
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ granted: true; version: string }> {
    const version = ConsentsService.VERSION_BY_TYPE[type];
    if (!version) {
      throw new BadRequestException(`Unknown consent type: ${type}`);
    }

    await db.insert(userConsents).values({
      userId,
      consentType: type,
      version,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });

    await this.auditLog.log({
      entityType: 'user',
      entityId: userId,
      action: 'pdpl.consent_granted',
      performedBy: userId,
      metadata: { consentType: type, version },
      ipAddress,
    });

    return { granted: true, version };
  }

  /**
   * Withdraw an active consent. Only the latest not-yet-withdrawn row for
   * the given type is affected. If the user has no active consent for
   * this type, we no-op (idempotent) rather than error.
   */
  async withdrawConsent(
    userId: string,
    type: ConsentType | 'sensitive_data',
    ipAddress?: string,
  ): Promise<{ withdrawn: boolean }> {
    const now = new Date();
    const result = await db
      .update(userConsents)
      .set({ withdrawnAt: now })
      .where(
        and(
          eq(userConsents.userId, userId),
          eq(userConsents.consentType, type),
          isNull(userConsents.withdrawnAt),
        ),
      );

    const withdrawn = (result.rowCount ?? 0) > 0;

    if (withdrawn) {
      await this.auditLog.log({
        entityType: 'user',
        entityId: userId,
        action: 'pdpl.consent_withdrawn',
        performedBy: userId,
        metadata: { consentType: type },
        ipAddress,
      });
    }

    return { withdrawn };
  }

  /**
   * Convenience for the Preferences UI: set marketing_email on/off with a
   * single call. `true` grants a new consent, `false` withdraws the
   * active one. Both branches are audited.
   */
  async setMarketingConsent(
    userId: string,
    enabled: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ enabled: boolean }> {
    if (enabled) {
      await this.grantConsent(
        userId,
        CONSENT_TYPE.MARKETING_EMAIL,
        ipAddress,
        userAgent,
      );
    } else {
      await this.withdrawConsent(
        userId,
        CONSENT_TYPE.MARKETING_EMAIL,
        ipAddress,
      );
    }
    return { enabled };
  }
}
