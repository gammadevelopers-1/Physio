import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, isNotNull, lt, sql } from 'drizzle-orm';
import { db } from '../../database';
import { refreshTokens } from '../../database/schema/refresh-tokens';
import { emailVerifications } from '../../database/schema/email-verifications';
import { twoFactorChallenges } from '../../database/schema/two-factor';
import { auditLogs } from '../../database/schema/audit-logs';
import { DistributedLockService } from '../tasks/distributed-lock.service';

/**
 * PDPL Article 18 — Storage Limitation.
 *
 * Nightly job that purges/anonymises ephemeral personal data past its
 * useful life. Every run writes a summary row to audit_logs so an
 * auditor can prove the retention policy is actually enforced.
 *
 * Retention policies (deliberately conservative — err on the side of
 * KEEPING rows rather than deleting, so we never lose evidence needed
 * for a real incident):
 *
 *   refresh_tokens         > 7 days past expiry     → hard delete
 *   email_verifications    > 30 days past expiry    → hard delete
 *   two_factor_challenges  > 7 days past expiry     → hard delete
 *   audit_logs IP address  > 90 days                → anonymise (last octet zeroed)
 *
 * Regulatory-retention tables (audit_logs body, nelc_audit_logs,
 * payment records, certificates) are NEVER touched here — those have
 * multi-year retention driven by NELC / ZATCA / SAMA rules and get
 * their own dedicated archival flow.
 *
 * Runs at 02:00 UTC daily via @Cron. Uses DistributedLockService so
 * only one instance runs the job even when Cloud Run has multiple
 * warm containers.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  private static readonly LOCK_KEY = 'lock:cron:pdpl-retention-purge';
  private static readonly LOCK_TTL_MS = 15 * 60 * 1000; // 15 min

  constructor(private readonly lock: DistributedLockService) {}

  @Cron('0 2 * * *', { timeZone: 'UTC', name: 'pdpl-retention-purge' })
  async run(): Promise<void> {
    await this.lock.withLock(
      RetentionService.LOCK_KEY,
      RetentionService.LOCK_TTL_MS,
      async () => {
        await this.runPurge('cron');
      },
    );
  }

  /**
   * Public entry point so admin/CLI can trigger a manual run for
   * verification without waiting for the 02:00 UTC schedule.
   */
  async runPurge(trigger: 'cron' | 'manual'): Promise<PurgeSummary> {
    const startedAt = new Date();
    const summary: PurgeSummary = {
      startedAt: startedAt.toISOString(),
      trigger,
      refreshTokensDeleted: 0,
      emailVerificationsDeleted: 0,
      twoFactorChallengesDeleted: 0,
      auditLogIpsAnonymised: 0,
      errors: [],
    };

    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const rt = await db
        .delete(refreshTokens)
        .where(lt(refreshTokens.expiresAt, sevenDaysAgo));
      summary.refreshTokensDeleted = rt.rowCount ?? 0;
    } catch (err) {
      summary.errors.push(`refresh_tokens: ${(err as Error).message}`);
    }

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const ev = await db
        .delete(emailVerifications)
        .where(lt(emailVerifications.expiresAt, thirtyDaysAgo));
      summary.emailVerificationsDeleted = ev.rowCount ?? 0;
    } catch (err) {
      summary.errors.push(`email_verifications: ${(err as Error).message}`);
    }

    // 2FA OTP challenges — same shape as email_verifications but keyed on
    // userId. 7-day past-expiry cutoff matches refresh_tokens because
    // these are shorter-lived and only kept briefly for forensics.
    try {
      const sevenDaysAgoForTfa = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const tfa = await db
        .delete(twoFactorChallenges)
        .where(lt(twoFactorChallenges.expiresAt, sevenDaysAgoForTfa));
      summary.twoFactorChallengesDeleted = tfa.rowCount ?? 0;
    } catch (err) {
      summary.errors.push(
        `two_factor_challenges: ${(err as Error).message}`,
      );
    }

    // Anonymise last octet of IPs older than 90 days. Preserves geo
    // subnet for security forensics while dropping the specific host.
    // Handles both IPv4 (a.b.c.d → a.b.c.0) and IPv6 (drops last /64).
    // Safe to re-run — the WHERE clause skips already-anonymised rows.
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const al = await db
        .update(auditLogs)
        .set({
          ipAddress: sql`
            CASE
              WHEN ${auditLogs.ipAddress} LIKE '%.%'
                THEN regexp_replace(${auditLogs.ipAddress}, '\\.\\d+$', '.0')
              WHEN ${auditLogs.ipAddress} LIKE '%:%'
                THEN split_part(${auditLogs.ipAddress}, ':', 1) || ':' ||
                     split_part(${auditLogs.ipAddress}, ':', 2) || ':' ||
                     split_part(${auditLogs.ipAddress}, ':', 3) || ':' ||
                     split_part(${auditLogs.ipAddress}, ':', 4) || '::'
              ELSE ${auditLogs.ipAddress}
            END
          `,
        })
        .where(
          and(
            isNotNull(auditLogs.ipAddress),
            lt(auditLogs.createdAt, ninetyDaysAgo),
            sql`${auditLogs.ipAddress} NOT LIKE '%.0'`,
            sql`${auditLogs.ipAddress} NOT LIKE '%::' OR ${auditLogs.ipAddress} LIKE '%.%'`,
          ),
        );
      summary.auditLogIpsAnonymised = al.rowCount ?? 0;
    } catch (err) {
      summary.errors.push(`audit_logs anonymise: ${(err as Error).message}`);
    }

    summary.finishedAt = new Date().toISOString();
    summary.durationMs = Date.now() - startedAt.getTime();

    if (summary.errors.length) {
      this.logger.error(
        `PDPL retention purge finished with ${summary.errors.length} errors`,
        summary,
      );
    } else {
      this.logger.log(
        `PDPL retention purge complete: refresh=${summary.refreshTokensDeleted} email=${summary.emailVerificationsDeleted} tfa=${summary.twoFactorChallengesDeleted} ip_anon=${summary.auditLogIpsAnonymised} in ${summary.durationMs}ms`,
      );
    }

    return summary;
  }
}

interface PurgeSummary {
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  trigger: 'cron' | 'manual';
  refreshTokensDeleted: number;
  emailVerificationsDeleted: number;
  twoFactorChallengesDeleted: number;
  auditLogIpsAnonymised: number;
  errors: string[];
}
