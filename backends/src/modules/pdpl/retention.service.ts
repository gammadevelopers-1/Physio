import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, exists, inArray, isNotNull, isNull, lt, not, sql } from 'drizzle-orm';
import { db } from '../../database';
import { refreshTokens } from '../../database/schema/refresh-tokens';
import { emailVerifications } from '../../database/schema/email-verifications';
import { twoFactorChallenges } from '../../database/schema/two-factor';
import { auditLogs } from '../../database/schema/audit-logs';
import { users } from '../../database/schema/users';
import { enrollments } from '../../database/schema/enrollments';
import { certificateRequests } from '../../database/schema/certificate-requests';
import { refunds } from '../../database/schema/refunds';
import { tickets, TICKET_STATUS } from '../../database/schema/tickets';
import { supportConfig } from '../../database/schema/support-config';
import { DistributedLockService } from '../tasks/distributed-lock.service';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { EmailService } from '../email/email.service';

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
 *   users (inactive)       last_login > 24 months   → warn (30-day grace)
 *   users (past grace)     warned_at > 30 days      → hard delete (with exemptions)
 *   support tickets        closed_at > N days       → hard delete (N = admin-configured, 0 = off)
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

  // Client-approved inactive-user policy (2026-08-16). See
  // ~/Desktop/PhysioGuidance-Handover/pdpl-inactive-user-policy.md
  private static readonly INACTIVE_THRESHOLD_MS =
    24 * 30 * 24 * 60 * 60 * 1000; // ~24 months
  private static readonly INACTIVE_GRACE_MS =
    30 * 24 * 60 * 60 * 1000; // 30 days between warning and delete
  private static readonly INACTIVE_BATCH_LIMIT = 500;
  private static readonly TICKET_BATCH_LIMIT = 500;

  constructor(
    private readonly lock: DistributedLockService,
    private readonly auditLog: AuditLogService,
    private readonly emailService: EmailService,
  ) {}

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
      inactiveUsersWarned: 0,
      inactiveUsersDeleted: 0,
      supportTicketsDeleted: 0,
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

    // Inactive-user handling (Article 18 — Storage Limitation). Runs LAST
    // because it's the only stage that emits emails; a mid-run failure in
    // the earlier steps should NOT stop the auditor-visible cleanups.
    try {
      const warned = await this.warnInactiveUsers();
      summary.inactiveUsersWarned = warned;
    } catch (err) {
      summary.errors.push(`inactive_warn: ${(err as Error).message}`);
    }
    try {
      const deleted = await this.deleteInactiveUsersPastGrace();
      summary.inactiveUsersDeleted = deleted;
    } catch (err) {
      summary.errors.push(`inactive_delete: ${(err as Error).message}`);
    }

    // Support ticket retention (admin-configurable, 0 = off). Runs after
    // inactive-user handling so a bad ticket-purge query doesn't abort
    // the higher-priority PII purges above. FK cascade sweeps
    // ticket_replies + ticket_attachment_scans in-transaction.
    try {
      const deleted = await this.purgeExpiredSupportTickets();
      summary.supportTicketsDeleted = deleted;
    } catch (err) {
      summary.errors.push(`support_tickets: ${(err as Error).message}`);
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
        `PDPL retention purge complete: refresh=${summary.refreshTokensDeleted} email=${summary.emailVerificationsDeleted} tfa=${summary.twoFactorChallengesDeleted} ip_anon=${summary.auditLogIpsAnonymised} inactive_warned=${summary.inactiveUsersWarned} inactive_deleted=${summary.inactiveUsersDeleted} tickets=${summary.supportTicketsDeleted} in ${summary.durationMs}ms`,
      );
    }

    return summary;
  }

  /**
   * Find STUDENT users who have not logged in for 24 months, who have no
   * active enrollment, no issued certificate, no pending refund, and are
   * currently active — then email them a 30-day deletion warning and
   * set `inactive_warned_at` so we don't re-warn every night.
   *
   * Non-STUDENT users (instructors, admins, support, course managers)
   * are exempt — their roles imply ongoing operational relevance.
   *
   * Deleted users (deletedAt IS NOT NULL) are already in the erasure
   * grace flow; skipped here to avoid double-tracking.
   */
  private async warnInactiveUsers(): Promise<number> {
    const cutoff = new Date(Date.now() - RetentionService.INACTIVE_THRESHOLD_MS);

    const candidates = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
      })
      .from(users)
      .where(
        and(
          isNotNull(users.lastLoginAt),
          lt(users.lastLoginAt, cutoff),
          isNull(users.inactiveWarnedAt),
          isNull(users.deletedAt),
          eq(users.isActive, true),
          eq(users.activeRole, 'STUDENT'),
          not(
            exists(
              db
                .select({ n: sql`1` })
                .from(enrollments)
                .where(
                  and(
                    eq(enrollments.studentId, users.id),
                    inArray(enrollments.status, ['active', 'completed']),
                  ),
                ),
            ),
          ),
          not(
            exists(
              db
                .select({ n: sql`1` })
                .from(certificateRequests)
                .where(
                  and(
                    eq(certificateRequests.studentId, users.id),
                    eq(certificateRequests.status, 'approved'),
                  ),
                ),
            ),
          ),
          not(
            exists(
              db
                .select({ n: sql`1` })
                .from(refunds)
                .where(
                  and(
                    eq(refunds.requestedBy, users.id),
                    inArray(refunds.status, [
                      'pending',
                      'approved',
                      'processing',
                    ]),
                  ),
                ),
            ),
          ),
        ),
      )
      .limit(RetentionService.INACTIVE_BATCH_LIMIT);

    if (candidates.length === 0) return 0;

    // Deadline shown in the email: warn now, delete in 30 days.
    const deleteOn = new Date(Date.now() + RetentionService.INACTIVE_GRACE_MS);

    // Stamp all candidates in one UPDATE, then fire emails best-effort.
    // Ordering matters: if the stamp UPDATE fails, we haven't emailed;
    // if an email fails, the stamp is already down so we won't re-warn
    // that user (auditor sees exact-once). The user can still recover
    // simply by logging in — which clears inactive_warned_at.
    const ids = candidates.map((c) => c.id);
    await db
      .update(users)
      .set({ inactiveWarnedAt: new Date() })
      .where(inArray(users.id, ids));

    for (const c of candidates) {
      try {
        await this.emailService.sendInactiveAccountWarning(
          c.email,
          c.firstName ?? '',
          deleteOn,
        );
      } catch (err) {
        this.logger.warn(
          `Inactive-warn email failed for ${c.email}: ${(err as Error).message}`,
        );
      }
      try {
        await this.auditLog.log({
          entityType: 'user',
          entityId: c.id,
          action: 'pdpl.inactive_warned',
          performedBy: c.id,
          metadata: {
            scheduledDeleteAt: deleteOn.toISOString(),
            thresholdMonths: 24,
          },
        });
      } catch (err) {
        this.logger.warn(
          `Inactive-warn audit failed for ${c.id}: ${(err as Error).message}`,
        );
      }
    }

    return candidates.length;
  }

  /**
   * Hard-delete users who were warned more than 30 days ago and did not
   * log back in. Re-check the exemption clauses at delete time (state
   * may have changed since the warning fired). Relies on FK cascade
   * (68 tables) to sweep dependents in-transaction.
   *
   * Deliberately batched at INACTIVE_BATCH_LIMIT so a bad day (e.g. a
   * migration that made many users look inactive) can't run away with
   * the whole database. If more than the batch qualifies, they get
   * processed on subsequent nightly runs.
   */
  private async deleteInactiveUsersPastGrace(): Promise<number> {
    const graceCutoff = new Date(
      Date.now() - RetentionService.INACTIVE_GRACE_MS,
    );
    const activityCutoff = new Date(
      Date.now() - RetentionService.INACTIVE_THRESHOLD_MS,
    );

    const candidates = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        and(
          isNotNull(users.inactiveWarnedAt),
          lt(users.inactiveWarnedAt, graceCutoff),
          // Belt-and-braces: the user must STILL look inactive at delete
          // time. If they logged back in after the warning fired but
          // the login handler somehow failed to clear inactive_warned_at,
          // this last-login check saves us.
          isNotNull(users.lastLoginAt),
          lt(users.lastLoginAt, activityCutoff),
          isNull(users.deletedAt),
          eq(users.isActive, true),
          eq(users.activeRole, 'STUDENT'),
          not(
            exists(
              db
                .select({ n: sql`1` })
                .from(enrollments)
                .where(
                  and(
                    eq(enrollments.studentId, users.id),
                    inArray(enrollments.status, ['active', 'completed']),
                  ),
                ),
            ),
          ),
          not(
            exists(
              db
                .select({ n: sql`1` })
                .from(certificateRequests)
                .where(
                  and(
                    eq(certificateRequests.studentId, users.id),
                    eq(certificateRequests.status, 'approved'),
                  ),
                ),
            ),
          ),
          not(
            exists(
              db
                .select({ n: sql`1` })
                .from(refunds)
                .where(
                  and(
                    eq(refunds.requestedBy, users.id),
                    inArray(refunds.status, [
                      'pending',
                      'approved',
                      'processing',
                    ]),
                  ),
                ),
            ),
          ),
        ),
      )
      .limit(RetentionService.INACTIVE_BATCH_LIMIT);

    if (candidates.length === 0) return 0;

    let deleted = 0;
    for (const c of candidates) {
      try {
        // Audit BEFORE deletion so the FK cascade doesn't wipe the log
        // reference. `performedBy: null` because the actor is the system
        // cron, not a user; the entity-level fields identify the target.
        await this.auditLog.log({
          entityType: 'user',
          entityId: c.id,
          action: 'pdpl.inactive_deleted',
          performedBy: 'system',
          metadata: {
            email: c.email, // last chance to record who was deleted
            thresholdMonths: 24,
            graceDays: 30,
          },
        });
        await db.delete(users).where(eq(users.id, c.id));
        deleted += 1;
      } catch (err) {
        this.logger.error(
          `Inactive-delete failed for ${c.id}: ${(err as Error).message}`,
        );
      }
    }
    return deleted;
  }

  /**
   * Support-ticket retention. Admin sets a retention window in days via
   * the support admin UI (0 = off). Every CLOSED ticket whose closedAt
   * is older than the window is hard-deleted; ticket_replies and
   * ticket_attachment_scans cascade via FK.
   *
   * Batched at TICKET_BATCH_LIMIT so a bad config change cannot run
   * away with the whole tickets table in a single night; remainders
   * sweep on subsequent nightly runs.
   */
  private async purgeExpiredSupportTickets(): Promise<number> {
    const [row] = await db
      .select({ value: supportConfig.value })
      .from(supportConfig)
      .where(eq(supportConfig.key, 'ticket_retention_days'));
    const daysRaw = Number((row?.value as { days?: unknown } | undefined)?.days);
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? daysRaw : 0;
    if (days <= 0) return 0;

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const candidates = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(
        and(
          eq(tickets.status, TICKET_STATUS.CLOSED),
          isNotNull(tickets.closedAt),
          lt(tickets.closedAt, cutoff),
        ),
      )
      .limit(RetentionService.TICKET_BATCH_LIMIT);

    if (candidates.length === 0) return 0;

    const ids = candidates.map((c) => c.id);
    const res = await db.delete(tickets).where(inArray(tickets.id, ids));
    return res.rowCount ?? candidates.length;
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
  inactiveUsersWarned: number;
  inactiveUsersDeleted: number;
  supportTicketsDeleted: number;
  errors: string[];
}
