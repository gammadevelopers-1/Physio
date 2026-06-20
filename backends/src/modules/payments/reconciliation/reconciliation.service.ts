import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, gte, lte, desc, inArray, sql } from 'drizzle-orm';
import { db } from '../../../database';
import {
  payments,
  reconciliationFindings,
  reconciliationScans,
  users,
  courses,
  RECONCILIATION_DRIFT_TYPE,
  RECONCILIATION_STATUS,
  RECONCILIATION_SCAN_STATUS,
  PAYMENT_STATUS,
} from '../../../database/schema';
import { MoyasarGateway } from '../gateways/moyasar.gateway';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

const MOYASAR_TERMINAL_STATUSES = new Set(['paid', 'captured', 'failed', 'refunded']);

/**
 * Drift detection between our payments table and each gateway's own records.
 * Phase 1: Moyasar only. Tamara + Tabby + Bank Transfer plug in here later.
 *
 * Scan flow (per gateway):
 *   1. Fetch all gateway records in the date window (paginated).
 *   2. For each gateway record:
 *      - find our local payment by gateway_charge_id
 *      - record drift if local is missing, amount differs, or status differs
 *   3. For each local payment in the window with a gateway_charge_id:
 *      - if no matching gateway record, record drift (missing_gateway)
 *
 * Findings dedup via a partial unique index — same drift on next scan
 * upserts to the existing UNRESOLVED row instead of creating duplicates.
 * Once resolved/ignored, a re-occurrence creates a fresh row.
 */
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly moyasar: MoyasarGateway,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ─── Scan entry point ────────────────────────────────────────────────

  async runScan(opts: {
    gateway: 'moyasar' | 'all';
    fromDate: Date;
    toDate: Date;
    triggeredBy: string | null;
  }) {
    if (opts.fromDate >= opts.toDate) {
      throw new BadRequestException('fromDate must be before toDate');
    }
    const windowDays = (opts.toDate.getTime() - opts.fromDate.getTime()) / 86_400_000;
    if (windowDays > 90) {
      throw new BadRequestException('Scan window cannot exceed 90 days');
    }

    const [scan] = await db
      .insert(reconciliationScans)
      .values({
        gateway: opts.gateway,
        fromDate: opts.fromDate,
        toDate: opts.toDate,
        status: RECONCILIATION_SCAN_STATUS.RUNNING,
        triggeredBy: opts.triggeredBy,
      })
      .returning();

    const startedAt = Date.now();
    try {
      let recordsScanned = 0;
      let driftsFound = 0;

      if (opts.gateway === 'moyasar' || opts.gateway === 'all') {
        const result = await this.scanMoyasar(scan.id, opts.fromDate, opts.toDate);
        recordsScanned += result.recordsScanned;
        driftsFound += result.driftsFound;
      }
      // Tamara / Tabby / Bank Transfer scans plug in here (Phase 2).

      await db
        .update(reconciliationScans)
        .set({
          status: RECONCILIATION_SCAN_STATUS.SUCCEEDED,
          recordsScanned,
          driftsFound,
          finishedAt: new Date(),
          durationMs: Date.now() - startedAt,
        })
        .where(eq(reconciliationScans.id, scan.id));

      this.logger.log(
        `Reconciliation scan ${scan.id} succeeded: gateway=${opts.gateway} ` +
          `records=${recordsScanned} drifts=${driftsFound} duration=${Date.now() - startedAt}ms`,
      );
      return { scanId: scan.id, recordsScanned, driftsFound };
    } catch (err) {
      await db
        .update(reconciliationScans)
        .set({
          status: RECONCILIATION_SCAN_STATUS.FAILED,
          finishedAt: new Date(),
          durationMs: Date.now() - startedAt,
          errorMessage: err instanceof Error ? err.message : String(err),
        })
        .where(eq(reconciliationScans.id, scan.id));
      this.logger.error(
        `Reconciliation scan ${scan.id} failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw err;
    }
  }

  // ─── Moyasar scan ────────────────────────────────────────────────────

  private async scanMoyasar(scanRunId: string, from: Date, to: Date) {
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    let page = 1;
    let recordsScanned = 0;
    let driftsFound = 0;
    const seenGatewayChargeIds = new Set<string>();

    // 1. Walk Moyasar's paginated invoice list and compare each to ours.
    while (true) {
      const { invoices, meta } = await this.moyasar.listInvoices({
        fromIso,
        toIso,
        page,
        perPage: 100,
      });

      for (const inv of invoices) {
        recordsScanned++;
        seenGatewayChargeIds.add(inv.id);

        const [local] = await db
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.gateway, 'moyasar'),
              eq(payments.gatewayChargeId, inv.id),
            ),
          )
          .limit(1);

        // Convert Moyasar amount from halalah to whole SAR for comparison.
        const gatewayAmountSar = Number(inv.amount) / 100;
        const gatewayStatus = String(inv.status || '').toLowerCase();

        if (!local) {
          // Only flag terminal-status invoices — pending/initiated invoices
          // are checkouts that may not have been completed yet and don't
          // necessarily indicate drift.
          if (MOYASAR_TERMINAL_STATUSES.has(gatewayStatus) && gatewayStatus !== 'failed') {
            await this.recordFinding({
              scanRunId,
              gateway: 'moyasar',
              driftType: RECONCILIATION_DRIFT_TYPE.MISSING_LOCAL,
              paymentId: null,
              gatewayChargeId: inv.id,
              ourValue: null,
              gatewayValue: {
                amount: gatewayAmountSar,
                currency: inv.currency,
                status: gatewayStatus,
                createdAt: inv.created_at,
              },
            });
            driftsFound++;
          }
          continue;
        }

        // Amount mismatch (allow 1 halalah of rounding tolerance).
        if (Math.abs(Number(local.amount) - gatewayAmountSar) > 0.01) {
          await this.recordFinding({
            scanRunId,
            gateway: 'moyasar',
            driftType: RECONCILIATION_DRIFT_TYPE.AMOUNT_MISMATCH,
            paymentId: local.id,
            gatewayChargeId: inv.id,
            ourValue: { amount: Number(local.amount), currency: local.currency },
            gatewayValue: { amount: gatewayAmountSar, currency: inv.currency },
          });
          driftsFound++;
        }

        // Status mismatch (only meaningful when both sides are terminal).
        const ourTerminal = [
          PAYMENT_STATUS.PAID,
          PAYMENT_STATUS.REFUNDED,
          PAYMENT_STATUS.PARTIALLY_REFUNDED,
        ];
        if (
          ourTerminal.includes(local.status as any) &&
          MOYASAR_TERMINAL_STATUSES.has(gatewayStatus) &&
          !this.statusesAlign(local.status, gatewayStatus)
        ) {
          await this.recordFinding({
            scanRunId,
            gateway: 'moyasar',
            driftType: RECONCILIATION_DRIFT_TYPE.STATUS_MISMATCH,
            paymentId: local.id,
            gatewayChargeId: inv.id,
            ourValue: { status: local.status },
            gatewayValue: { status: gatewayStatus },
          });
          driftsFound++;
        }
      }

      if (!meta.next_page) break;
      page = meta.next_page;
    }

    // 2. Find LOCAL Moyasar payments in the window with a charge id that we
    //    did NOT see on the gateway side → missing_gateway drift.
    const localPayments = await db
      .select({ id: payments.id, gatewayChargeId: payments.gatewayChargeId, status: payments.status, amount: payments.amount })
      .from(payments)
      .where(
        and(
          eq(payments.gateway, 'moyasar'),
          gte(payments.createdAt, from),
          lte(payments.createdAt, to),
          inArray(payments.status, [
            PAYMENT_STATUS.PAID,
            PAYMENT_STATUS.REFUNDED,
            PAYMENT_STATUS.PARTIALLY_REFUNDED,
          ] as any),
        ),
      );

    for (const p of localPayments) {
      if (!p.gatewayChargeId) {
        // Paid Moyasar payment with no charge id — that's a separate data
        // integrity bug; surface as missing_gateway with no charge id so finance
        // sees it.
        await this.recordFinding({
          scanRunId,
          gateway: 'moyasar',
          driftType: RECONCILIATION_DRIFT_TYPE.MISSING_GATEWAY,
          paymentId: p.id,
          gatewayChargeId: null,
          ourValue: { status: p.status, amount: Number(p.amount) },
          gatewayValue: null,
        });
        driftsFound++;
        continue;
      }
      if (!seenGatewayChargeIds.has(p.gatewayChargeId)) {
        await this.recordFinding({
          scanRunId,
          gateway: 'moyasar',
          driftType: RECONCILIATION_DRIFT_TYPE.MISSING_GATEWAY,
          paymentId: p.id,
          gatewayChargeId: p.gatewayChargeId,
          ourValue: { status: p.status, amount: Number(p.amount) },
          gatewayValue: null,
        });
        driftsFound++;
      }
    }

    return { recordsScanned, driftsFound };
  }

  /**
   * Map Moyasar's status to our status and decide if they "agree".
   * Moyasar uses 'paid' / 'refunded' / 'failed'. Our schema uses the same
   * plus 'partially_refunded' (which we'd want both Moyasar to also report
   * as 'refunded' OR a partial — Moyasar reports the full payment as
   * 'refunded' even on partial, so we accept that case).
   */
  private statusesAlign(ourStatus: string, gatewayStatus: string): boolean {
    if (ourStatus === PAYMENT_STATUS.PAID && gatewayStatus === 'paid') return true;
    if (
      (ourStatus === PAYMENT_STATUS.REFUNDED ||
        ourStatus === PAYMENT_STATUS.PARTIALLY_REFUNDED) &&
      gatewayStatus === 'refunded'
    ) {
      return true;
    }
    return false;
  }

  private async recordFinding(args: {
    scanRunId: string;
    gateway: string;
    driftType: string;
    paymentId: string | null;
    gatewayChargeId: string | null;
    ourValue: Record<string, unknown> | null;
    gatewayValue: Record<string, unknown> | null;
  }) {
    // Idempotent insert: if a matching UNRESOLVED row already exists for the
    // same (gateway, drift_type, charge id), update its values instead of
    // inserting a duplicate. The partial unique indexes (see migration 0086)
    // enforce this at the DB layer.
    try {
      await db.insert(reconciliationFindings).values({
        scanRunId: args.scanRunId,
        gateway: args.gateway,
        driftType: args.driftType,
        paymentId: args.paymentId,
        gatewayChargeId: args.gatewayChargeId,
        ourValue: args.ourValue as any,
        gatewayValue: args.gatewayValue as any,
        status: RECONCILIATION_STATUS.UNRESOLVED,
      });
    } catch (err: any) {
      // Postgres unique violation = the drift is already on the unresolved
      // list. Refresh its scanRunId + values so the finance UI shows the
      // latest evidence; status stays UNRESOLVED.
      if (err.code === '23505') {
        const conditions =
          args.gatewayChargeId !== null
            ? and(
                eq(reconciliationFindings.gateway, args.gateway),
                eq(reconciliationFindings.driftType, args.driftType),
                eq(reconciliationFindings.gatewayChargeId, args.gatewayChargeId),
                eq(reconciliationFindings.status, RECONCILIATION_STATUS.UNRESOLVED),
              )
            : args.paymentId !== null
              ? and(
                  eq(reconciliationFindings.gateway, args.gateway),
                  eq(reconciliationFindings.driftType, args.driftType),
                  eq(reconciliationFindings.paymentId, args.paymentId),
                  eq(reconciliationFindings.status, RECONCILIATION_STATUS.UNRESOLVED),
                )
              : null;
        if (conditions) {
          await db
            .update(reconciliationFindings)
            .set({
              scanRunId: args.scanRunId,
              ourValue: args.ourValue as any,
              gatewayValue: args.gatewayValue as any,
              updatedAt: new Date(),
            })
            .where(conditions);
        }
        return;
      }
      throw err;
    }
  }

  // ─── Read endpoints ──────────────────────────────────────────────────

  async listFindings(opts: {
    status?: 'unresolved' | 'resolved' | 'ignored' | 'all';
    gateway?: string;
    driftType?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(100, Math.max(1, opts.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (opts.status && opts.status !== 'all') {
      conditions.push(eq(reconciliationFindings.status, opts.status));
    } else if (!opts.status) {
      conditions.push(
        eq(reconciliationFindings.status, RECONCILIATION_STATUS.UNRESOLVED),
      );
    }
    if (opts.gateway) {
      conditions.push(eq(reconciliationFindings.gateway, opts.gateway));
    }
    if (opts.driftType) {
      conditions.push(eq(reconciliationFindings.driftType, opts.driftType));
    }
    const whereExpr = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: reconciliationFindings.id,
        scanRunId: reconciliationFindings.scanRunId,
        gateway: reconciliationFindings.gateway,
        driftType: reconciliationFindings.driftType,
        paymentId: reconciliationFindings.paymentId,
        gatewayChargeId: reconciliationFindings.gatewayChargeId,
        ourValue: reconciliationFindings.ourValue,
        gatewayValue: reconciliationFindings.gatewayValue,
        status: reconciliationFindings.status,
        resolutionNote: reconciliationFindings.resolutionNote,
        resolvedBy: reconciliationFindings.resolvedBy,
        resolvedAt: reconciliationFindings.resolvedAt,
        createdAt: reconciliationFindings.createdAt,
        userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        userEmail: users.email,
        courseTitle: courses.title,
      })
      .from(reconciliationFindings)
      .leftJoin(payments, eq(payments.id, reconciliationFindings.paymentId))
      .leftJoin(users, eq(users.id, payments.userId))
      .leftJoin(courses, eq(courses.id, payments.courseId))
      .where(whereExpr)
      .orderBy(desc(reconciliationFindings.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalRow] = await db
      .select({ value: sql<number>`COUNT(*)::int` })
      .from(reconciliationFindings)
      .where(whereExpr);

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: Number(totalRow?.value || 0),
        totalPages: Math.ceil(Number(totalRow?.value || 0) / limit) || 1,
      },
    };
  }

  async getStats() {
    const counts = await db
      .select({
        status: reconciliationFindings.status,
        driftType: reconciliationFindings.driftType,
        gateway: reconciliationFindings.gateway,
        c: sql<number>`COUNT(*)::int`,
      })
      .from(reconciliationFindings)
      .groupBy(
        reconciliationFindings.status,
        reconciliationFindings.driftType,
        reconciliationFindings.gateway,
      );

    const lastScans = await db
      .select()
      .from(reconciliationScans)
      .orderBy(desc(reconciliationScans.startedAt))
      .limit(10);

    let unresolved = 0;
    const byDriftType: Record<string, number> = {};
    const byGateway: Record<string, number> = {};
    for (const r of counts) {
      if (r.status === RECONCILIATION_STATUS.UNRESOLVED) {
        unresolved += r.c;
        byDriftType[r.driftType] = (byDriftType[r.driftType] || 0) + r.c;
        byGateway[r.gateway] = (byGateway[r.gateway] || 0) + r.c;
      }
    }

    return { unresolved, byDriftType, byGateway, lastScans };
  }

  // ─── Resolve / ignore ────────────────────────────────────────────────

  async resolveFinding(
    findingId: string,
    user: AuthenticatedUser,
    note: string | undefined,
    ipAddress?: string,
  ) {
    const result = await this.transitionFinding(
      findingId,
      user.id,
      RECONCILIATION_STATUS.RESOLVED,
      note,
    );
    await this.auditLogService.log({
      entityType: 'reconciliation_finding',
      entityId: findingId,
      action: 'reconciliation_resolved',
      performedBy: user.id,
      ipAddress,
      metadata: { note: note || null },
    });
    return result;
  }

  async ignoreFinding(
    findingId: string,
    user: AuthenticatedUser,
    note: string | undefined,
    ipAddress?: string,
  ) {
    if (!note || note.trim().length < 5) {
      throw new BadRequestException(
        'Please add a note (≥5 chars) explaining why this finding is being ignored',
      );
    }
    const result = await this.transitionFinding(
      findingId,
      user.id,
      RECONCILIATION_STATUS.IGNORED,
      note,
    );
    await this.auditLogService.log({
      entityType: 'reconciliation_finding',
      entityId: findingId,
      action: 'reconciliation_ignored',
      performedBy: user.id,
      ipAddress,
      metadata: { note },
    });
    return result;
  }

  private async transitionFinding(
    findingId: string,
    userId: string,
    newStatus: string,
    note: string | undefined,
  ) {
    const [updated] = await db
      .update(reconciliationFindings)
      .set({
        status: newStatus,
        resolutionNote: note?.trim() || null,
        resolvedBy: userId,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(reconciliationFindings.id, findingId),
          eq(reconciliationFindings.status, RECONCILIATION_STATUS.UNRESOLVED),
        ),
      )
      .returning();

    if (!updated) {
      const [exists] = await db
        .select({ status: reconciliationFindings.status })
        .from(reconciliationFindings)
        .where(eq(reconciliationFindings.id, findingId))
        .limit(1);
      if (!exists) {
        throw new NotFoundException('Finding not found');
      }
      throw new ConflictException(
        `Finding is already ${exists.status} — only unresolved findings can be transitioned`,
      );
    }
    return { id: updated.id, status: updated.status };
  }
}
