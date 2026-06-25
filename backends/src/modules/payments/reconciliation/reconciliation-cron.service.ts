import { Injectable, Logger } from '@nestjs/common';
import { eq, and, lte, gte, isNull, isNotNull, sql, inArray, asc, desc, or } from 'drizzle-orm';
import { db } from '../../../database';
import {
  reconciliationFindings,
  reconciliationEscalations,
  reconciliationSettings,
  payments,
  users,
  courses,
  roles,
  userRoles,
  RECONCILIATION_STATUS,
  ESCALATION_STATUS,
  ESCALATION_URGENCY,
  ESCALATION_PROPOSED_ACTION,
} from '../../../database/schema';
import { ReconciliationService } from './reconciliation.service';
import { EmailService } from '../../email/email.service';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { GatewayFactory } from '../gateways/gateway.factory';
import { PaymentsService } from '../payments.service';

// Compile-time fallbacks if the settings rows are missing. The settings
// table seed (migration 0089) mirrors these — keep in sync if you change
// either side.
const DEFAULT_SETTINGS = {
  scanWindowHours: 26,
  digestEnabled: true,
  stalePendingHours: 24,
  staleInProgressHours: 72,
  autoEscalate: {
    missing_local: { afterHours: 6, urgency: 'high' as const },
    paid_no_receipt: { afterHours: 24, urgency: 'high' as const },
    orphan_receipt: { afterHours: 24, urgency: 'normal' as const },
    stuck_approval: { afterHours: 336, urgency: 'normal' as const },
  } as Record<string, { afterHours: number; urgency: 'low' | 'normal' | 'high' }>,
};

/**
 * Cron entry point for reconciliation. Called by Cloud Scheduler →
 * authenticated HTTP endpoint → `runDailyScan()`. Three jobs:
 *
 *   runDailyScan()           — daily ~02:00 KSA: scan all gateways, auto-
 *                              escalate critical drifts, send daily digest
 *   runStaleReminderSweep()  — daily ~10:00 KSA: nag admins about pending
 *                              escalations older than the threshold
 *
 * Both jobs are idempotent at the data layer (recordFinding uses partial
 * unique indexes; escalations have the active-per-finding guard), so an
 * accidental double-fire from Scheduler is safe.
 */
@Injectable()
export class ReconciliationCronService {
  private readonly logger = new Logger(ReconciliationCronService.name);

  constructor(
    private readonly reconciliationService: ReconciliationService,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
    private readonly gatewayFactory: GatewayFactory,
    private readonly paymentsService: PaymentsService,
  ) {}

  // ─── Daily scan + auto-escalate + digest ─────────────────────────────

  async runDailyScan(): Promise<{
    scanId: string;
    recordsScanned: number;
    driftsFound: number;
    autoEscalated: number;
    digestSent: boolean;
  }> {
    const startedAt = Date.now();
    const settings = await this.loadSettings();
    const now = new Date();
    const to = now;
    const from = new Date(
      now.getTime() - settings.scanWindowHours * 60 * 60 * 1000,
    );

    this.logger.log(
      `Daily reconciliation scan starting: window ${from.toISOString()} → ${to.toISOString()}`,
    );

    let scanResult: { scanId: string; recordsScanned: number; driftsFound: number };
    try {
      scanResult = await this.reconciliationService.runScan({
        gateway: 'all',
        fromDate: from,
        toDate: to,
        triggeredBy: null, // null = system
      });
    } catch (err) {
      this.logger.error(
        `Daily scan failed: ${(err as Error).message}`,
      );
      // Try to alert admins so they can manually retry. Best-effort.
      await this.sendScanFailureAlert((err as Error).message).catch((e) =>
        this.logger.error(`Also failed to send scan-failure alert: ${e.message}`),
      );
      throw err;
    }

    // Auto-escalate eligible findings (created in this scan run + any older
    // findings that have now aged past their threshold).
    const autoEscalated = await this.runAutoEscalation(settings);

    // Send digest unless disabled.
    let digestSent = false;
    if (settings.digestEnabled) {
      digestSent = await this.sendDailyDigest(scanResult, autoEscalated, settings);
    }

    await this.auditLogService.log({
      entityType: 'reconciliation_scan',
      entityId: scanResult.scanId,
      action: 'reconciliation_cron_scan_completed',
      // 'system' is converted to null by AuditLogService — the column is
      // a UUID FK to users, so system-triggered events go in with NULL.
      performedBy: 'system',
      metadata: {
        recordsScanned: scanResult.recordsScanned,
        driftsFound: scanResult.driftsFound,
        autoEscalated,
        digestSent,
        durationMs: Date.now() - startedAt,
      },
    });

    return {
      ...scanResult,
      autoEscalated,
      digestSent,
    };
  }

  // ─── Stale escalation reminder sweep ─────────────────────────────────

  async runStaleReminderSweep(): Promise<{
    pendingReminded: number;
    inProgressReminded: number;
  }> {
    const settings = await this.loadSettings();
    const now = Date.now();

    const stalePendingCutoff = new Date(
      now - settings.stalePendingHours * 60 * 60 * 1000,
    );
    const staleInProgressCutoff = new Date(
      now - settings.staleInProgressHours * 60 * 60 * 1000,
    );

    const stalePending = await db
      .select({ id: reconciliationEscalations.id })
      .from(reconciliationEscalations)
      .where(
        and(
          eq(reconciliationEscalations.status, ESCALATION_STATUS.PENDING),
          lte(reconciliationEscalations.escalatedAt, stalePendingCutoff),
        ),
      );

    const staleInProgress = await db
      .select({
        id: reconciliationEscalations.id,
        claimedBy: reconciliationEscalations.claimedBy,
      })
      .from(reconciliationEscalations)
      .where(
        and(
          eq(reconciliationEscalations.status, ESCALATION_STATUS.IN_PROGRESS),
          lte(reconciliationEscalations.claimedAt, staleInProgressCutoff),
        ),
      );

    if (stalePending.length > 0) {
      const adminEmails = await this.getRecipientEmails(['ADMIN', 'SUPER_ADMIN']);
      if (adminEmails.length > 0) {
        await this.emailService.sendReconciliationStaleReminder(
          adminEmails,
          'pending',
          stalePending.length,
          settings.stalePendingHours,
        );
      }
    }

    // For in-progress, nag the claiming admin individually so we don't
    // spam everyone about something one person already owns.
    if (staleInProgress.length > 0) {
      const byAdmin = new Map<string, number>();
      for (const e of staleInProgress) {
        if (e.claimedBy) {
          byAdmin.set(e.claimedBy, (byAdmin.get(e.claimedBy) || 0) + 1);
        }
      }
      for (const [adminId, count] of byAdmin) {
        const [adminUser] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, adminId))
          .limit(1);
        if (adminUser?.email) {
          await this.emailService.sendReconciliationStaleReminder(
            [adminUser.email],
            'in_progress',
            count,
            settings.staleInProgressHours,
          );
        }
      }
    }

    this.logger.log(
      `Stale reminder sweep: pending=${stalePending.length}, in_progress=${staleInProgress.length}`,
    );

    return {
      pendingReminded: stalePending.length,
      inProgressReminded: staleInProgress.length,
    };
  }

  // ─── Internal: auto-escalation ───────────────────────────────────────

  private async runAutoEscalation(settings: typeof DEFAULT_SETTINGS): Promise<number> {
    let autoEscalated = 0;
    const now = Date.now();

    for (const [driftType, rule] of Object.entries(settings.autoEscalate)) {
      const ageCutoff = new Date(now - rule.afterHours * 60 * 60 * 1000);

      // Eligible: unresolved findings of this drift type, older than the
      // threshold, with no active escalation already attached. We use the
      // status=UNRESOLVED filter (not just != ESCALATED) so resolved/
      // ignored findings never get a fresh escalation regardless of age.
      const eligible = await db
        .select({ id: reconciliationFindings.id })
        .from(reconciliationFindings)
        .where(
          and(
            eq(reconciliationFindings.driftType, driftType),
            eq(reconciliationFindings.status, RECONCILIATION_STATUS.UNRESOLVED),
            lte(reconciliationFindings.createdAt, ageCutoff),
            isNull(reconciliationFindings.escalationId),
          ),
        );

      for (const f of eligible) {
        try {
          await db.transaction(async (tx) => {
            const [escalation] = await tx
              .insert(reconciliationEscalations)
              .values({
                findingId: f.id,
                escalatedBy: null, // system
                escalationNote:
                  `Auto-escalated by reconciliation cron: this ${driftType} drift has been unresolved for over ${rule.afterHours} hours. ` +
                  'A human needs to act — see drift evidence + payment context on this page.',
                proposedAction: ESCALATION_PROPOSED_ACTION.SYSTEM_INFERRED,
                urgency: rule.urgency,
                status: ESCALATION_STATUS.PENDING,
              })
              .returning();
            await tx
              .update(reconciliationFindings)
              .set({
                status: RECONCILIATION_STATUS.ESCALATED,
                escalationId: escalation.id,
                updatedAt: new Date(),
              })
              .where(eq(reconciliationFindings.id, f.id));
          });
          autoEscalated++;
        } catch (err: any) {
          // 23505 = race with a human who escalated the same finding at
          // the same time. Safe to ignore — their escalation wins.
          if (err.code === '23505') continue;
          this.logger.error(
            `Auto-escalation of finding ${f.id} (${driftType}) failed: ${err.message}`,
          );
        }
      }
    }

    if (autoEscalated > 0) {
      this.logger.log(`Auto-escalated ${autoEscalated} findings`);
      // Email admins. We send ONE consolidated email per cron run, not one
      // per auto-escalation, to avoid inbox flood when a backlog catches
      // up overnight.
      const adminEmails = await this.getRecipientEmails(['ADMIN', 'SUPER_ADMIN']);
      if (adminEmails.length > 0) {
        await this.emailService
          .sendReconciliationAutoEscalationSummary(adminEmails, autoEscalated)
          .catch((err) =>
            this.logger.error(`Failed to send auto-escalation summary: ${err.message}`),
          );
      }
    }

    return autoEscalated;
  }

  // ─── Internal: daily digest ──────────────────────────────────────────

  private async sendDailyDigest(
    scanResult: { recordsScanned: number; driftsFound: number },
    autoEscalated: number,
    settings: typeof DEFAULT_SETTINGS,
  ): Promise<boolean> {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // Per-gateway breakdown (from the last 24h of findings).
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const perGatewayRaw = await db
      .select({
        gateway: reconciliationFindings.gateway,
        drifts: sql<number>`COUNT(*)::int`,
        autoEsc: sql<number>`COUNT(*) FILTER (WHERE ${reconciliationFindings.escalationId} IS NOT NULL)::int`,
      })
      .from(reconciliationFindings)
      .where(gte(reconciliationFindings.createdAt, since))
      .groupBy(reconciliationFindings.gateway);

    // We don't store "records scanned" per gateway separately for this
    // window, so we approximate by attributing the full scanResult split
    // evenly. Good-enough signal for the digest.
    const perGateway = perGatewayRaw.map((r) => ({
      gateway: r.gateway,
      scanned: Math.round(scanResult.recordsScanned / Math.max(1, perGatewayRaw.length)),
      drifts: Number(r.drifts || 0),
      autoEscalated: Number(r.autoEsc || 0),
    }));

    // Top 5 auto-escalations from this run (newest first).
    const topAuto = await db
      .select({
        id: reconciliationEscalations.id,
        urgency: reconciliationEscalations.urgency,
        driftType: reconciliationFindings.driftType,
        amount: payments.amount,
        currency: payments.currency,
        customerEmail: users.email,
        escalatedAt: reconciliationEscalations.escalatedAt,
      })
      .from(reconciliationEscalations)
      .innerJoin(
        reconciliationFindings,
        eq(reconciliationFindings.id, reconciliationEscalations.findingId),
      )
      .leftJoin(payments, eq(payments.id, reconciliationFindings.paymentId))
      .leftJoin(users, eq(users.id, payments.userId))
      .where(
        and(
          isNull(reconciliationEscalations.escalatedBy), // system-escalated
          gte(reconciliationEscalations.escalatedAt, since),
        ),
      )
      .orderBy(desc(reconciliationEscalations.escalatedAt))
      .limit(5);

    // Backlog (everything still pending/in_progress regardless of when).
    const [pendingCount] = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(reconciliationEscalations)
      .where(
        and(
          inArray(reconciliationEscalations.status, [
            ESCALATION_STATUS.PENDING,
            ESCALATION_STATUS.IN_PROGRESS,
          ]),
          lte(reconciliationEscalations.escalatedAt, since),
        ),
      );
    const [oldestPending] = await db
      .select({ escalatedAt: reconciliationEscalations.escalatedAt })
      .from(reconciliationEscalations)
      .where(
        and(
          inArray(reconciliationEscalations.status, [
            ESCALATION_STATUS.PENDING,
            ESCALATION_STATUS.IN_PROGRESS,
          ]),
        ),
      )
      .orderBy(asc(reconciliationEscalations.escalatedAt))
      .limit(1);
    const oldestPendingDays = oldestPending
      ? Math.floor((now.getTime() - oldestPending.escalatedAt.getTime()) / 86_400_000)
      : null;

    const base = process.env.FRONTEND_URL || 'https://physioguidance.org';
    const dashboardUrl = `${base}/en/dashboard/admin/finance/escalations`;
    const topAutoEscalations = topAuto.map((e) => ({
      urgency: e.urgency as 'low' | 'normal' | 'high',
      driftType: e.driftType,
      amount: e.amount ? `${e.amount} ${e.currency || 'SAR'}` : null,
      customer: e.customerEmail || '—',
      ageHours: Math.floor((now.getTime() - e.escalatedAt.getTime()) / (60 * 60 * 1000)),
      url: `${base}/en/dashboard/admin/finance/escalations/${e.id}`,
    }));

    const recipients = await this.getRecipientEmails([
      'FINANCE',
      'ADMIN',
      'SUPER_ADMIN',
    ]);
    if (recipients.length === 0) {
      this.logger.warn('No digest recipients found — skipping daily digest.');
      return false;
    }

    await this.emailService.sendReconciliationDigest(recipients, {
      scanDate: today,
      perGateway,
      topAutoEscalations,
      pendingFromPriorDays: Number(pendingCount?.c || 0),
      oldestPendingDays,
      dashboardUrl,
    });

    return true;
  }

  // ─── Internal: scan failure alert ────────────────────────────────────

  private async sendScanFailureAlert(errorMessage: string): Promise<void> {
    const adminEmails = await this.getRecipientEmails(['ADMIN', 'SUPER_ADMIN']);
    if (adminEmails.length === 0) return;
    await this.emailService.sendReconciliationScanFailedAlert(
      adminEmails,
      errorMessage,
    );
  }

  // ─── Settings ────────────────────────────────────────────────────────

  private async loadSettings(): Promise<typeof DEFAULT_SETTINGS> {
    const rows = await db
      .select({ key: reconciliationSettings.key, value: reconciliationSettings.value })
      .from(reconciliationSettings);

    const byKey = new Map<string, any>();
    for (const r of rows) byKey.set(r.key, r.value);

    const get = <T>(key: string, fallback: T): T => {
      const v = byKey.get(key);
      return v == null ? fallback : (v as T);
    };

    return {
      scanWindowHours: get('cron.scan_window_hours', DEFAULT_SETTINGS.scanWindowHours),
      digestEnabled: get('cron.daily_digest_enabled', DEFAULT_SETTINGS.digestEnabled),
      stalePendingHours: get(
        'cron.stale_reminder.pending_hours',
        DEFAULT_SETTINGS.stalePendingHours,
      ),
      staleInProgressHours: get(
        'cron.stale_reminder.in_progress_hours',
        DEFAULT_SETTINGS.staleInProgressHours,
      ),
      autoEscalate: {
        missing_local: get(
          'auto_escalate.missing_local',
          DEFAULT_SETTINGS.autoEscalate.missing_local,
        ),
        paid_no_receipt: get(
          'auto_escalate.paid_no_receipt',
          DEFAULT_SETTINGS.autoEscalate.paid_no_receipt,
        ),
        orphan_receipt: get(
          'auto_escalate.orphan_receipt',
          DEFAULT_SETTINGS.autoEscalate.orphan_receipt,
        ),
        stuck_approval: get(
          'auto_escalate.stuck_approval',
          DEFAULT_SETTINGS.autoEscalate.stuck_approval,
        ),
      },
    };
  }

  private async getRecipientEmails(roleNames: string[]): Promise<string[]> {
    const conditions = roleNames.map((n) => eq(roles.name, n));
    const where = conditions.length === 1 ? conditions[0] : or(...conditions);
    const rows = await db
      .selectDistinct({ email: users.email })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(where);
    return rows.map((r) => r.email).filter((e): e is string => !!e);
  }

  // ─── Abandoned payment sweep ─────────────────────────────────────────
  //
  // When a student clicks Pay we create a row immediately with status
  // 'pending' (required so we have an id to hand off to the gateway and
  // so webhooks can map back). If they bail before completing checkout,
  // that row stays pending forever — polluting the payments table and
  // the "Pending" KPI.
  //
  // This sweep marks pending/processing rows older than `abandonAfterHours`
  // with NO gateway_charge_id (i.e. the gateway never even saw them) as
  // 'abandoned'. Default view on the Payments page excludes them so
  // finance only sees actionable rows; reconciliation can still surface
  // them when chasing drift.

  async runAbandonedPaymentSweep(opts: { abandonAfterHours?: number } = {}): Promise<{
    sweptCount: number;
    cutoff: string;
  }> {
    const abandonAfterHours = opts.abandonAfterHours ?? 24;
    const cutoff = new Date(Date.now() - abandonAfterHours * 60 * 60 * 1000);

    this.logger.log(
      `Abandoned payment sweep starting: marking pending/processing rows with no gateway_charge_id older than ${cutoff.toISOString()}`,
    );

    const result = await db
      .update(payments)
      .set({ status: 'abandoned' as any, updatedAt: new Date() })
      .where(
        and(
          inArray(payments.status, ['pending', 'processing'] as any),
          isNull(payments.gatewayChargeId),
          lte(payments.createdAt, cutoff),
        ),
      )
      .returning({ id: payments.id });

    const sweptCount = result.length;
    this.logger.log(`Abandoned sweep complete: ${sweptCount} payments marked abandoned`);

    // One audit row per swept payment so the payment drawer shows the
    // automatic transition. We tag performedBy=null (system) and include
    // the cutoff so the reviewer can see exactly which rule fired.
    for (const row of result) {
      await this.auditLogService.log({
        entityType: 'payment',
        entityId: row.id,
        action: 'payment_abandoned_by_sweep',
        performedBy: 'system',
        ipAddress: 'cron',
        metadata: {
          cutoff: cutoff.toISOString(),
          abandonAfterHours,
          reason: 'No gateway charge created within window',
        },
      });
    }

    return { sweptCount, cutoff: cutoff.toISOString() };
  }

  // ─── BNPL status poll ────────────────────────────────────────────────
  //
  // Webhook-or-poll fallback per Tabby's docs:
  //   https://docs.tabby.ai/pay-in-4-custom-integration/payment-processing
  //   "implement payment verification (by webhooks or multiple retrieve requests)"
  //
  // Tabby + Tamara payments can land in 'pending' / 'processing' for a few
  // reasons that webhooks alone don't catch:
  //   - Webhook delivery dropped on the gateway side (rare but happens)
  //   - Tamara's order_approved fired before our authorise/capture
  //     completed, leaving the order at status='approved' on their side
  //     while ours stayed 'pending'
  //   - Network blip during the synchronous create-charge path
  //
  // This sweep finds BNPL payments stuck in pending/processing for >5min
  // (gives the webhook path a chance to land first) and <24h (older are
  // truly abandoned — handled by runAbandonedPaymentSweep), polls each
  // gateway's status API, and applies the terminal outcome via the same
  // PaymentsService methods the webhook path uses. The Tamara gateway's
  // getPaymentStatus is self-healing (calls authorise+capture inline when
  // it sees status='approved'), so this sweep also recovers stuck Tamara
  // orders end-to-end.

  async runBnplStatusPoll(opts: { minAgeMinutes?: number; maxAgeHours?: number } = {}): Promise<{
    inspected: number;
    transitionedToPaid: number;
    transitionedToFailed: number;
    stillPending: number;
    errors: number;
  }> {
    const minAgeMinutes = opts.minAgeMinutes ?? 5;
    const maxAgeHours = opts.maxAgeHours ?? 24;
    const upperCutoff = new Date(Date.now() - minAgeMinutes * 60 * 1000);
    const lowerCutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    const stale = await db
      .select({
        id: payments.id,
        gateway: payments.gateway,
        gatewayChargeId: payments.gatewayChargeId,
        status: payments.status,
      })
      .from(payments)
      .where(
        and(
          inArray(payments.gateway, ['tabby', 'tamara'] as any),
          inArray(payments.status, ['pending', 'processing'] as any),
          isNotNull(payments.gatewayChargeId),
          lte(payments.createdAt, upperCutoff),
          gte(payments.createdAt, lowerCutoff),
        ),
      )
      .limit(200);

    this.logger.log(
      `BNPL status poll starting: ${stale.length} pending/processing tabby+tamara rows in [${lowerCutoff.toISOString()}, ${upperCutoff.toISOString()}]`,
    );

    let transitionedToPaid = 0;
    let transitionedToFailed = 0;
    let stillPending = 0;
    let errors = 0;

    for (const row of stale) {
      if (!row.gatewayChargeId) continue;
      try {
        const gw = this.gatewayFactory.getGateway(row.gateway);
        const normalized = await gw.getPaymentStatus(row.gatewayChargeId);

        if (normalized === 'paid') {
          await this.paymentsService.processPaymentSuccess(row.id);
          transitionedToPaid++;
        } else if (normalized === 'failed' || normalized === 'cancelled') {
          await this.paymentsService.processPaymentFailure(
            row.id,
            `Polled status from ${row.gateway}: ${normalized}`,
            'gateway_error',
          );
          transitionedToFailed++;
        } else {
          stillPending++;
        }
      } catch (err) {
        errors++;
        this.logger.warn(
          `BNPL poll failed for payment ${row.id} (${row.gateway}): ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `BNPL status poll complete: paid=${transitionedToPaid}, failed=${transitionedToFailed}, still-pending=${stillPending}, errors=${errors}`,
    );

    await this.auditLogService.log({
      entityType: 'reconciliation_scan',
      entityId: `bnpl_poll_${Date.now()}`,
      action: 'bnpl_status_poll_completed',
      performedBy: 'system',
      ipAddress: 'cron',
      metadata: {
        inspected: stale.length,
        transitionedToPaid,
        transitionedToFailed,
        stillPending,
        errors,
        minAgeMinutes,
        maxAgeHours,
      },
    });

    return {
      inspected: stale.length,
      transitionedToPaid,
      transitionedToFailed,
      stillPending,
      errors,
    };
  }
}
