import {
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  sql,
  SQL,
} from 'drizzle-orm';
import { db } from '../../../database';
import {
  payments,
  paymentItems,
  courses,
  enrollments,
  refunds,
  invoices,
  PAYMENT_STATUS,
  PAYMENT_GATEWAY,
} from '../../../database/schema';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';
import { CurrentUser, Roles } from '../../auth/decorators';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { GatewayCredentialsService } from '../gateways/gateway-credentials.service';
import { RefundPolicyService } from '../services/refund-policy.service';
import { RefundService } from '../services/refund.service';

/**
 * Student-facing finance API. Read-only for the most part — students see
 * their own payments, invoices, and refund requests. The only mutation is
 * `POST /refunds` (handled by RefundsController) which already enforces
 * `requesterId === user.id`, so this controller doesn't re-implement it.
 *
 * Permission model: every query is filtered by `payments.userId === user.id`
 * (or the equivalent for refunds/invoices). There's no admin-impersonation
 * path here — that lives on the admin/finance controllers.
 *
 * All money values come back as decimal strings (matches how `numeric(10,2)`
 * columns serialize) plus the original Number for convenience. UI formats
 * with `Intl.NumberFormat` per locale.
 */
@SkipThrottle()
@Controller('student/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STUDENT')
export class StudentFinanceController {
  constructor(
    private readonly credentials: GatewayCredentialsService,
    private readonly refundPolicy: RefundPolicyService,
    private readonly refundService: RefundService,
  ) {}

  // ─── Overview ─────────────────────────────────────────────────────

  /**
   * Dashboard landing: counts + lifetime/YTD totals + last 5 payments.
   * VAT YTD is the sum of `metadata.taxAmount` from paid rows in the
   * current calendar year — used by self-employed students who file
   * their own VAT returns.
   */
  @Get('overview')
  async getOverview(@CurrentUser() user: AuthenticatedUser) {
    const startOfYear = new Date(new Date().getUTCFullYear(), 0, 1);

    // Aggregate counts + sums in a single query per metric — drizzle has
    // no FILTER (WHERE …) shortcut so we use conditional sums via CASE.
    const [agg] = await db
      .select({
        paidCount: sql<number>`COUNT(*) FILTER (WHERE ${payments.status} = ${PAYMENT_STATUS.PAID})`,
        pendingCount: sql<number>`COUNT(*) FILTER (WHERE ${payments.status} IN (${PAYMENT_STATUS.PENDING}, ${PAYMENT_STATUS.PROCESSING}, ${PAYMENT_STATUS.AWAITING_APPROVAL}))`,
        refundedCount: sql<number>`COUNT(*) FILTER (WHERE ${payments.status} IN (${PAYMENT_STATUS.REFUNDED}, ${PAYMENT_STATUS.PARTIALLY_REFUNDED}))`,
        totalPaidSar: sql<string>`COALESCE(SUM(${payments.amount}) FILTER (WHERE ${payments.status} = ${PAYMENT_STATUS.PAID}), 0)`,
        vatPaidYtdSar: sql<string>`COALESCE(SUM(((${payments.metadata}->>'taxAmount')::numeric)) FILTER (WHERE ${payments.status} = ${PAYMENT_STATUS.PAID} AND ${payments.paidAt} >= ${startOfYear.toISOString()}), 0)`,
      })
      .from(payments)
      .where(eq(payments.userId, user.id));

    const [refundInFlight] = await db
      .select({
        c: sql<number>`COUNT(*) FILTER (WHERE ${refunds.status} IN ('pending', 'approved', 'processing'))`,
      })
      .from(refunds)
      .innerJoin(payments, eq(refunds.paymentId, payments.id))
      .where(eq(payments.userId, user.id));

    const recent = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        gateway: payments.gateway,
        status: payments.status,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
      })
      .from(payments)
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .where(eq(payments.userId, user.id))
      .orderBy(desc(payments.createdAt))
      .limit(5);

    return {
      counts: {
        paid: Number(agg.paidCount),
        pending: Number(agg.pendingCount),
        refunded: Number(agg.refundedCount),
        refundInFlight: Number(refundInFlight?.c ?? 0),
      },
      totals: {
        lifetimePaidSar: Number(agg.totalPaidSar),
        vatPaidYtdSar: Number(agg.vatPaidYtdSar),
        currency: 'SAR',
      },
      recentPayments: recent,
    };
  }

  // ─── Payments list ───────────────────────────────────────────────

  /**
   * Filtered list of the student's own payments. Filters are optional —
   * leaving them all blank returns the full history paginated by createdAt
   * desc. `status=all` is a no-op convenience for the frontend.
   */
  @Get('payments')
  async listPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('gateway') gateway?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('courseId') courseId?: string,
  ) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const offset = (Math.max(page, 1) - 1) * safeLimit;

    const filters: SQL[] = [eq(payments.userId, user.id)];

    if (status && status !== 'all') {
      const allowed = new Set(Object.values(PAYMENT_STATUS));
      if (allowed.has(status as (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS])) {
        filters.push(eq(payments.status, status));
      }
    }
    if (gateway && gateway !== 'all') {
      const allowed = new Set(Object.values(PAYMENT_GATEWAY));
      if (allowed.has(gateway as (typeof PAYMENT_GATEWAY)[keyof typeof PAYMENT_GATEWAY])) {
        filters.push(eq(payments.gateway, gateway));
      }
    }
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!Number.isNaN(d.getTime())) filters.push(gte(payments.createdAt, d));
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (!Number.isNaN(d.getTime())) {
        // Inclusive: bump to end-of-day so the filter matches expectations.
        d.setHours(23, 59, 59, 999);
        filters.push(lte(payments.createdAt, d));
      }
    }
    if (courseId) {
      filters.push(eq(payments.courseId, courseId));
    }

    const where = and(...filters);

    const [{ total }] = await db
      .select({ total: count() })
      .from(payments)
      .where(where);

    const rows = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        gateway: payments.gateway,
        paymentMethod: payments.paymentMethod,
        status: payments.status,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        metadata: payments.metadata,
        courseId: payments.courseId,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        // Invoice + refund presence flags — saves the client from extra
        // round-trips when rendering action buttons.
        invoiceId: invoices.id,
      })
      .from(payments)
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .leftJoin(invoices, eq(invoices.paymentId, payments.id))
      .where(where)
      .orderBy(desc(payments.createdAt))
      .limit(safeLimit)
      .offset(offset);

    return {
      data: rows.map((r) => ({
        ...r,
        // Projected VAT/subtotal triplet so the UI can show breakdown in
        // the row without re-fetching detail.
        vatBreakdown: extractVatBreakdown(r.metadata, r.amount),
        hasInvoice: !!r.invoiceId,
      })),
      pagination: {
        page,
        limit: safeLimit,
        total: Number(total),
        pages: Math.ceil(Number(total) / safeLimit),
      },
    };
  }

  // ─── Payment detail ──────────────────────────────────────────────

  /**
   * Full detail of a single payment owned by the requesting student. Bundles
   * the eligibility check + any existing refund history so the drawer
   * can render in one call.
   */
  @Get('payments/:id')
  async getPaymentDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const [row] = await db
      .select({
        id: payments.id,
        userId: payments.userId,
        courseId: payments.courseId,
        enrollmentId: payments.enrollmentId,
        gateway: payments.gateway,
        gatewayChargeId: payments.gatewayChargeId,
        paymentMethod: payments.paymentMethod,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        metadata: payments.metadata,
        paidAt: payments.paidAt,
        failedAt: payments.failedAt,
        failureReason: payments.failureReason,
        createdAt: payments.createdAt,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        courseDeliveryType: courses.deliveryType,
        invoiceId: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
      })
      .from(payments)
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .leftJoin(invoices, eq(invoices.paymentId, payments.id))
      .where(and(eq(payments.id, id), eq(payments.userId, user.id)))
      .limit(1);

    if (!row) {
      // Same not-found shape as if it doesn't exist at all — don't leak
      // "this id exists but belongs to someone else".
      throw new NotFoundException('Payment not found');
    }

    // Pull existing refunds for this payment so the drawer can surface
    // "Refund pending" / "Refunded on …" without a second request.
    const refundRows = await db
      .select({
        id: refunds.id,
        status: refunds.status,
        reason: refunds.reason,
        reasonNote: refunds.reasonNote,
        originalAmount: refunds.originalAmount,
        refundAmount: refunds.refundAmount,
        deductionAmount: refunds.deductionAmount,
        createdAt: refunds.createdAt,
        approvedAt: refunds.approvedAt,
        completedAt: refunds.completedAt,
        rejectedAt: refunds.rejectedAt,
        rejectionNote: refunds.rejectionNote,
      })
      .from(refunds)
      .where(eq(refunds.paymentId, id))
      .orderBy(desc(refunds.createdAt));

    // Live eligibility check — uses the same RefundPolicyService that the
    // server-side refund POST will re-validate against. Source of truth.
    //
    // Multi-line cart payments (bank-transfer drafts and any other cart
    // checkout) leave payments.enrollmentId null and store per-line
    // enrollment ids on payment_items. Fall back to the first line's
    // enrollment id so the UI doesn't say "No enrollment found" and the
    // refund button stays enabled for legitimately enrolled buyers.
    let eligibility: Awaited<
      ReturnType<RefundPolicyService['checkEligibility']>
    > = { eligible: false, blockedBy: null, reason: 'No enrollment found' };
    let primaryEnrollmentId: string | null = row.enrollmentId;
    if (!primaryEnrollmentId) {
      const [firstItem] = await db
        .select({ enrollmentId: paymentItems.enrollmentId })
        .from(paymentItems)
        .where(
          and(
            eq(paymentItems.paymentId, id),
            isNotNull(paymentItems.enrollmentId),
          ),
        )
        .limit(1);
      primaryEnrollmentId = firstItem?.enrollmentId ?? null;
    }
    if (primaryEnrollmentId) {
      eligibility = await this.refundPolicy.checkEligibility(primaryEnrollmentId);
    }

    // Hard gates that aren't part of policy:
    //   - payment must be `paid` (bank-transfer in review isn't refundable)
    //   - no in-flight refund (pending/approved/processing) already exists
    //   - full refund already issued → ineligible
    const hasInflight = refundRows.some((r) =>
      ['pending', 'approved', 'processing'].includes(r.status),
    );
    const alreadyRefunded = row.status === PAYMENT_STATUS.REFUNDED;
    const canRequestRefund =
      row.status === PAYMENT_STATUS.PAID &&
      !hasInflight &&
      !alreadyRefunded &&
      eligibility.eligible;

    // Decorate eligibility with the hard-gate reason if applicable so UI
    // only needs to read one field to render the disabled-state copy.
    let refundReason = eligibility.reason;
    let refundBlockedBy: string | null = eligibility.blockedBy;
    if (row.status === PAYMENT_STATUS.AWAITING_APPROVAL) {
      refundReason = 'Refund unavailable while bank transfer is under review.';
      refundBlockedBy = 'bank_transfer_under_review';
    } else if (row.status !== PAYMENT_STATUS.PAID && !alreadyRefunded) {
      refundReason = 'Only paid payments can be refunded.';
      refundBlockedBy = 'not_paid';
    } else if (alreadyRefunded) {
      refundReason = 'This payment has already been fully refunded.';
      refundBlockedBy = 'already_refunded';
    } else if (hasInflight) {
      refundReason = 'You already have a refund request in progress for this payment.';
      refundBlockedBy = 'refund_in_progress';
    }

    const gatewayKey = row.gateway as
      | 'moyasar' | 'tamara' | 'tabby' | 'bank_transfer' | 'mock';
    const policy = await this.refundPolicy.getPolicy();
    const perGateway = policy.perGateway[gatewayKey] ?? {
      deductionPercent: 0,
      partialRefundCapable: false,
    };

    // Per-course line breakdown for the drawer + refund modal. Same
    // projection the refund POST will consume — so what the student
    // sees (per-course price, per-course refund status) matches exactly
    // what they can request.
    const breakdown = await this.refundService.getPaymentLineBreakdown(id);

    return {
      payment: {
        ...row,
        vatBreakdown: extractVatBreakdown(row.metadata, row.amount),
      },
      refunds: refundRows,
      lineItems: breakdown.lines.map((l) => ({
        paymentItemId: l.paymentItemId,
        courseId: l.courseId,
        courseTitle: l.courseTitle,
        courseTitleAr: l.courseTitleAr,
        enrollmentId: l.enrollmentId,
        enrollmentStatus: l.enrollmentStatus,
        unitPrice: l.unitPrice,
        lineSubtotal: l.lineSubtotal,
        lineDiscount: l.lineDiscount,
        lineVat: l.lineVat,
        lineTotal: l.lineTotal,
        alreadyRefundedByRefundId: l.refundedByRefundId,
      })),
      refundability: {
        canRequest: canRequestRefund,
        blockedBy: refundBlockedBy,
        reason: refundReason,
        partialAllowed: perGateway.partialRefundCapable,
        // Customer always receives the full refundAmount; deductionPercent
        // represents the merchant fee we (the seller) bear, NOT what's
        // taken from the customer. UI uses this to explain "you'll receive
        // 100% — we cover the gateway's processing fee".
        merchantDeductionPercent: perGateway.deductionPercent,
      },
    };
  }

  // ─── Payment lookup by enrollment ────────────────────────────────

  /**
   * Resolve `enrollmentId → paymentId` so course-detail pages can deep-link
   * the student to their billing drawer with a single click. Handles both
   * legacy single-course payments (where `payments.enrollment_id` is set)
   * and cart-checkout payments (where the enrollment link lives on the
   * `payment_items` row).
   *
   * Returns 404 — not 200-with-null — when the enrollment has no payment,
   * so the caller can hide the "View receipt" CTA cleanly via try/catch.
   *
   * Permission: filtered by `payments.userId === user.id`. A student can
   * never resolve another student's enrollment.
   */
  @Get('payment-by-enrollment/:enrollmentId')
  async getPaymentByEnrollment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<{ paymentId: string }> {
    // 1. Legacy single-enrollment shape.
    const [direct] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.userId, user.id),
          eq(payments.enrollmentId, enrollmentId),
          eq(payments.status, PAYMENT_STATUS.PAID),
        ),
      )
      .orderBy(desc(payments.paidAt))
      .limit(1);

    if (direct) return { paymentId: direct.id };

    // 2. Cart-checkout shape — enrollment lives on a payment_items row.
    const [viaItem] = await db
      .select({ id: payments.id })
      .from(paymentItems)
      .innerJoin(payments, eq(payments.id, paymentItems.paymentId))
      .where(
        and(
          eq(paymentItems.enrollmentId, enrollmentId),
          eq(payments.userId, user.id),
          eq(payments.status, PAYMENT_STATUS.PAID),
        ),
      )
      .orderBy(desc(payments.paidAt))
      .limit(1);

    if (viaItem) return { paymentId: viaItem.id };

    throw new NotFoundException('No paid payment found for this enrollment');
  }

  // ─── Policy snapshot ─────────────────────────────────────────────

  /**
   * Single source of truth that the student-side billing UI reads for:
   *   - Refund eligibility rules (lifecycle gates) — show student what
   *     window they're inside before they navigate to request a refund
   *   - Per-gateway constraints (partial-capable, merchant deduction)
   *   - Currently-active payment methods (hide methods that aren't
   *     configured so students don't see a dead "Pay with Tabby" button)
   *
   * Reads the SAME services that admin reads from + the SAME services
   * that the refund POST will re-validate against. Cached client-side
   * for 60s; admin policy changes propagate on next refetch.
   *
   * Note: secrets are never returned — only `mode` (test/live) so we can
   * show a "Sandbox mode" notice if the platform is non-production.
   */
  @Get('policy-snapshot')
  async getPolicySnapshot() {
    const policy = await this.refundPolicy.getPolicy();

    // Refresh credentials so a freshly-rotated gateway shows up live.
    await this.credentials.refresh();
    const m = this.credentials.getMoyasar();
    const t = this.credentials.getTamara();
    const b = this.credentials.getTabby();
    const bank = this.credentials.getBankTransfer();

    return {
      rules: policy.rules,
      perGateway: policy.perGateway,
      // Public projection — no secrets, no source/lastFour exposed.
      activeGateways: {
        moyasar: {
          available: !!m.secretKey,
          mode: m.mode,
        },
        tamara: {
          available: !!t.apiToken,
          mode: t.mode,
        },
        tabby: {
          available: !!b.secretKey,
          mode: b.mode,
        },
        bank_transfer: {
          available: !!(bank.bankNameEn || bank.bankNameAr),
          mode: null,
        },
      },
    };
  }
}

/**
 * Pull subtotal / VAT / total from a payment's metadata blob. Falls back
 * to "subtotal = amount, VAT = 0" when metadata is missing (legacy rows
 * stored before VAT breakdown was added). The caller decides whether to
 * show the breakdown UI based on whether `vatAmount > 0`.
 */
function extractVatBreakdown(
  metadata: unknown,
  paidAmount: string,
): {
  subtotalSar: number;
  vatSar: number;
  totalSar: number;
  vatRatePct: number;
  discountSar: number;
} {
  const total = Number(paidAmount) || 0;
  if (!metadata || typeof metadata !== 'object') {
    return {
      subtotalSar: total,
      vatSar: 0,
      totalSar: total,
      vatRatePct: 0,
      discountSar: 0,
    };
  }
  const meta = metadata as Record<string, unknown>;
  const subtotal = numOrUndef(meta.subtotal);
  const vat = numOrUndef(meta.taxAmount);
  const rate = numOrUndef(meta.taxRate);
  const discount = numOrUndef(meta.discountAmount);
  return {
    subtotalSar: subtotal ?? total - (vat ?? 0),
    vatSar: vat ?? 0,
    totalSar: total,
    vatRatePct: rate ?? (vat && subtotal ? Math.round((vat / subtotal) * 100) : 0),
    discountSar: discount ?? 0,
  };
}

function numOrUndef(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}
