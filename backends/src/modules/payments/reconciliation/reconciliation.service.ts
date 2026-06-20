import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, gte, lte, desc, inArray, sql, isNull, notInArray } from 'drizzle-orm';
import { db } from '../../../database';
import {
  payments,
  paymentReceipts,
  reconciliationFindings,
  reconciliationEscalations,
  reconciliationScans,
  users,
  courses,
  RECONCILIATION_DRIFT_TYPE,
  RECONCILIATION_STATUS,
  RECONCILIATION_SCAN_STATUS,
  PAYMENT_STATUS,
  RECEIPT_REVIEW_STATUS,
} from '../../../database/schema';
import { MoyasarGateway } from '../gateways/moyasar.gateway';
import { TamaraGateway } from '../gateways/tamara.gateway';
import { TabbyGateway } from '../gateways/tabby.gateway';
import { NormalizedPaymentStatus } from '../gateways/gateway-types';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

const MOYASAR_TERMINAL_STATUSES = new Set(['paid', 'captured', 'failed', 'refunded']);

// Sweep tunables. These are not user-configurable yet — exposing them in
// settings is a Phase 3 concern.
const STUCK_PENDING_AGE_MS = 24 * 60 * 60 * 1000; // 24h
const STUCK_APPROVAL_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
// Cap the per-scan API hammer: re-fetching one Tabby/Tamara payment at a
// time is fine, but a 90-day window with hundreds of pending rows would
// burn rate limits. If the user needs more coverage they can narrow the
// window or wait for the daily cron (Phase 3) to chew through it.
const SWEEP_MAX_PAYMENTS = 200;

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
    private readonly tamara: TamaraGateway,
    private readonly tabby: TabbyGateway,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ─── Scan entry point ────────────────────────────────────────────────

  async runScan(opts: {
    gateway: 'moyasar' | 'tamara' | 'tabby' | 'bank_transfer' | 'all';
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
      if (opts.gateway === 'tamara' || opts.gateway === 'all') {
        const result = await this.scanTamara(scan.id, opts.fromDate, opts.toDate);
        recordsScanned += result.recordsScanned;
        driftsFound += result.driftsFound;
      }
      if (opts.gateway === 'tabby' || opts.gateway === 'all') {
        const result = await this.scanTabby(scan.id, opts.fromDate, opts.toDate);
        recordsScanned += result.recordsScanned;
        driftsFound += result.driftsFound;
      }
      if (opts.gateway === 'bank_transfer' || opts.gateway === 'all') {
        const result = await this.scanBankTransfer(scan.id, opts.fromDate, opts.toDate);
        recordsScanned += result.recordsScanned;
        driftsFound += result.driftsFound;
      }

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

  // ─── Tamara scan (webhook-recovery sweep) ────────────────────────────
  //
  // Tamara's `/merchants/orders` list endpoint requires a permission flag
  // that's not enabled on our merchant account (returns 403). Until Tamara
  // turns it on we can't do bidirectional drift detection — we can only
  // re-fetch each local Tamara payment by ID and check whether the gateway
  // status now disagrees with ours.
  //
  // What this catches:
  //   - status_mismatch  — Tamara says paid/captured but we still say pending
  //                        (webhook dropped or our retry chain stalled)
  //   - amount_mismatch  — captured amount differs (partial-capture edge case)
  //   - stuck_pending    — we say pending, Tamara also says pending, but the
  //                        payment is > 24h old (buyer abandoned the flow)
  //
  // It does NOT catch missing_local — without a Tamara list endpoint we have
  // no way to know about an order that exists on Tamara but never produced
  // a payment row on our side.

  private async scanTamara(scanRunId: string, from: Date, to: Date) {
    return this.gatewayRefetchSweep({
      scanRunId,
      from,
      to,
      gateway: 'tamara',
      fetchStatus: async (id) => this.tamara.getPaymentStatus(id),
      fetchRaw: (id) => this.tamara.getCharge(id),
      // Tamara's raw GET returns total_amount: { amount, currency } at the
      // top level when the order has been captured.
      extractAmount: (raw) =>
        raw?.total_amount?.amount != null ? Number(raw.total_amount.amount) : null,
    });
  }

  // ─── Tabby scan (webhook-recovery sweep) ─────────────────────────────
  //
  // Tabby has no merchant list API. Same shape as Tamara: walk our local
  // Tabby payments in the window, re-fetch each, flag drift.

  private async scanTabby(scanRunId: string, from: Date, to: Date) {
    return this.gatewayRefetchSweep({
      scanRunId,
      from,
      to,
      gateway: 'tabby',
      fetchStatus: (id) => this.tabby.getPaymentStatus(id),
      fetchRaw: (id) => this.tabby.getCharge(id),
      // Tabby returns amount at top level as a stringified decimal.
      extractAmount: (raw) =>
        raw?.amount != null ? Number(raw.amount) : null,
    });
  }

  /**
   * Per-payment refetch sweep used by both Tamara and Tabby. Iterates local
   * payments in the window, hits the gateway's get-by-id endpoint for each,
   * and records drift. Capped at SWEEP_MAX_PAYMENTS to bound API hammering.
   */
  private async gatewayRefetchSweep(args: {
    scanRunId: string;
    from: Date;
    to: Date;
    gateway: 'tamara' | 'tabby';
    fetchStatus: (id: string) => Promise<NormalizedPaymentStatus>;
    fetchRaw: (id: string) => Promise<any>;
    extractAmount: (raw: any) => number | null;
  }) {
    const { scanRunId, from, to, gateway, fetchStatus, fetchRaw, extractAmount } = args;

    // Walk payments we'd want to re-verify: anything PENDING or PAID with a
    // charge id. We deliberately exclude FAILED/REFUNDED — terminal-failed
    // rows are usually fine and re-checking them every scan is just noise.
    const candidates = await db
      .select({
        id: payments.id,
        gatewayChargeId: payments.gatewayChargeId,
        status: payments.status,
        amount: payments.amount,
        currency: payments.currency,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(
        and(
          eq(payments.gateway, gateway),
          gte(payments.createdAt, from),
          lte(payments.createdAt, to),
          inArray(payments.status, [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PAID] as any),
        ),
      )
      .orderBy(desc(payments.createdAt))
      .limit(SWEEP_MAX_PAYMENTS);

    let recordsScanned = 0;
    let driftsFound = 0;
    const now = Date.now();

    for (const p of candidates) {
      if (!p.gatewayChargeId) continue;
      recordsScanned++;

      let normalizedStatus: NormalizedPaymentStatus;
      let raw: any;
      try {
        normalizedStatus = await fetchStatus(p.gatewayChargeId);
        raw = await fetchRaw(p.gatewayChargeId);
      } catch (err) {
        // A single payment failing to refetch shouldn't kill the whole scan.
        // Log and skip — the daily cron will retry on the next pass.
        this.logger.warn(
          `${gateway} refetch failed for charge=${p.gatewayChargeId}: ${(err as Error).message}`,
        );
        continue;
      }

      // status_mismatch — local PENDING but gateway says paid/refunded.
      if (
        p.status === PAYMENT_STATUS.PENDING &&
        (normalizedStatus === 'paid' || normalizedStatus === 'refunded')
      ) {
        await this.recordFinding({
          scanRunId,
          gateway,
          driftType: RECONCILIATION_DRIFT_TYPE.STATUS_MISMATCH,
          paymentId: p.id,
          gatewayChargeId: p.gatewayChargeId,
          ourValue: { status: p.status },
          gatewayValue: { status: normalizedStatus },
        });
        driftsFound++;
        continue;
      }

      // status_mismatch — local PAID but gateway says failed/cancelled/refunded.
      if (
        p.status === PAYMENT_STATUS.PAID &&
        (normalizedStatus === 'failed' ||
          normalizedStatus === 'cancelled' ||
          normalizedStatus === 'refunded')
      ) {
        await this.recordFinding({
          scanRunId,
          gateway,
          driftType: RECONCILIATION_DRIFT_TYPE.STATUS_MISMATCH,
          paymentId: p.id,
          gatewayChargeId: p.gatewayChargeId,
          ourValue: { status: p.status },
          gatewayValue: { status: normalizedStatus },
        });
        driftsFound++;
        continue;
      }

      // amount_mismatch — only meaningful when both sides agree it's paid.
      if (
        p.status === PAYMENT_STATUS.PAID &&
        normalizedStatus === 'paid'
      ) {
        const gatewayAmount = extractAmount(raw);
        if (gatewayAmount != null && Math.abs(Number(p.amount) - gatewayAmount) > 0.01) {
          await this.recordFinding({
            scanRunId,
            gateway,
            driftType: RECONCILIATION_DRIFT_TYPE.AMOUNT_MISMATCH,
            paymentId: p.id,
            gatewayChargeId: p.gatewayChargeId,
            ourValue: { amount: Number(p.amount), currency: p.currency },
            gatewayValue: { amount: gatewayAmount },
          });
          driftsFound++;
        }
        continue;
      }

      // stuck_pending — both sides still PENDING after 24h. Either the buyer
      // abandoned the checkout or the gateway lost the session.
      if (
        p.status === PAYMENT_STATUS.PENDING &&
        normalizedStatus === 'pending' &&
        now - p.createdAt.getTime() > STUCK_PENDING_AGE_MS
      ) {
        await this.recordFinding({
          scanRunId,
          gateway,
          driftType: RECONCILIATION_DRIFT_TYPE.STUCK_PENDING,
          paymentId: p.id,
          gatewayChargeId: p.gatewayChargeId,
          ourValue: { status: p.status, createdAt: p.createdAt.toISOString() },
          gatewayValue: { status: normalizedStatus },
        });
        driftsFound++;
      }
    }

    return { recordsScanned, driftsFound };
  }

  // ─── Bank Transfer scan (internal consistency) ───────────────────────
  //
  // No external gateway — this is an internal audit of the bank-transfer
  // flow. Three checks:
  //
  //   stuck_approval  — payment in awaiting_approval > 7d (finance forgot it)
  //   orphan_receipt  — receipt approved but payment never advanced to PAID
  //   paid_no_receipt — payment PAID via bank transfer but no receipt row
  //                     (manual override or schema bypass — needs review)

  private async scanBankTransfer(scanRunId: string, from: Date, to: Date) {
    let recordsScanned = 0;
    let driftsFound = 0;
    const cutoff = new Date(Date.now() - STUCK_APPROVAL_AGE_MS);

    // 1. stuck_approval — bank-transfer payments in awaiting_approval whose
    //    last status change is older than 7 days. updatedAt is the closest
    //    proxy we have for "when did finance last touch this" since the
    //    payments table doesn't carry an explicit awaiting-since timestamp.
    const stuck = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        updatedAt: payments.updatedAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(
        and(
          eq(payments.gateway, 'bank_transfer'),
          eq(payments.status, PAYMENT_STATUS.AWAITING_APPROVAL),
          gte(payments.createdAt, from),
          lte(payments.createdAt, to),
          lte(payments.updatedAt, cutoff),
        ),
      );

    for (const p of stuck) {
      recordsScanned++;
      await this.recordFinding({
        scanRunId,
        gateway: 'bank_transfer',
        driftType: RECONCILIATION_DRIFT_TYPE.STUCK_APPROVAL,
        paymentId: p.id,
        gatewayChargeId: null,
        ourValue: {
          status: PAYMENT_STATUS.AWAITING_APPROVAL,
          amount: Number(p.amount),
          currency: p.currency,
          waitingSince: p.updatedAt.toISOString(),
        },
        gatewayValue: null,
      });
      driftsFound++;
    }

    // 2. orphan_receipt — approved receipt but payment is NOT PAID/REFUNDED.
    //    This catches the data-integrity bug where the receipt review
    //    pathway approved a receipt but the payment row update failed.
    //    We scope by receipt.createdAt rather than payment.createdAt because
    //    receipts can be uploaded weeks after the payment originated.
    const orphans = await db
      .select({
        receiptId: paymentReceipts.id,
        paymentId: paymentReceipts.paymentId,
        receiptStatus: paymentReceipts.reviewStatus,
        reviewedAt: paymentReceipts.reviewedAt,
        paymentStatus: payments.status,
      })
      .from(paymentReceipts)
      .innerJoin(payments, eq(payments.id, paymentReceipts.paymentId))
      .where(
        and(
          eq(paymentReceipts.reviewStatus, RECEIPT_REVIEW_STATUS.APPROVED),
          gte(paymentReceipts.createdAt, from),
          lte(paymentReceipts.createdAt, to),
          notInArray(payments.status, [
            PAYMENT_STATUS.PAID,
            PAYMENT_STATUS.REFUNDED,
            PAYMENT_STATUS.PARTIALLY_REFUNDED,
          ] as any),
          // Skip receipts that got superseded by a re-upload — only the
          // active receipt in the chain represents drift.
          isNull(paymentReceipts.replacedById),
        ),
      );

    for (const o of orphans) {
      recordsScanned++;
      await this.recordFinding({
        scanRunId,
        gateway: 'bank_transfer',
        driftType: RECONCILIATION_DRIFT_TYPE.ORPHAN_RECEIPT,
        paymentId: o.paymentId,
        gatewayChargeId: null,
        ourValue: {
          paymentStatus: o.paymentStatus,
          receiptId: o.receiptId,
          receiptStatus: o.receiptStatus,
          reviewedAt: o.reviewedAt?.toISOString() || null,
        },
        gatewayValue: null,
      });
      driftsFound++;
    }

    // 3. paid_no_receipt — payment PAID via bank-transfer with no receipt
    //    row at all. Either finance recorded it manually (legitimate but
    //    worth surfacing) or something bypassed the receipt-upload pathway.
    const paidNoReceipt = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        paidAt: payments.paidAt,
      })
      .from(payments)
      .leftJoin(paymentReceipts, eq(paymentReceipts.paymentId, payments.id))
      .where(
        and(
          eq(payments.gateway, 'bank_transfer'),
          eq(payments.status, PAYMENT_STATUS.PAID),
          gte(payments.createdAt, from),
          lte(payments.createdAt, to),
          isNull(paymentReceipts.id),
        ),
      );

    for (const p of paidNoReceipt) {
      recordsScanned++;
      await this.recordFinding({
        scanRunId,
        gateway: 'bank_transfer',
        driftType: RECONCILIATION_DRIFT_TYPE.PAID_NO_RECEIPT,
        paymentId: p.id,
        gatewayChargeId: null,
        ourValue: {
          status: PAYMENT_STATUS.PAID,
          amount: Number(p.amount),
          currency: p.currency,
          paidAt: p.paidAt?.toISOString() || null,
        },
        gatewayValue: null,
      });
      driftsFound++;
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
        // Linked escalation context. We always join (regardless of finding
        // status) so finance can see admin's note even after a finding
        // has been sent back and is technically 'unresolved' again. The
        // pointer is set by EscalationsService and survives sendBack via
        // keepEscalationPointer=true (E.1 bug fix).
        escalationId: reconciliationEscalations.id,
        escalationStatus: reconciliationEscalations.status,
        escalationActionTaken: reconciliationEscalations.actionTaken,
        escalationResolutionNote: reconciliationEscalations.resolutionNote,
        escalationResolvedAt: reconciliationEscalations.resolvedAt,
        escalationResolvedByName: sql<string>`(SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = ${reconciliationEscalations.resolvedBy})`,
      })
      .from(reconciliationFindings)
      .leftJoin(payments, eq(payments.id, reconciliationFindings.paymentId))
      .leftJoin(users, eq(users.id, payments.userId))
      .leftJoin(courses, eq(courses.id, payments.courseId))
      .leftJoin(
        reconciliationEscalations,
        eq(reconciliationEscalations.id, reconciliationFindings.escalationId),
      )
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
