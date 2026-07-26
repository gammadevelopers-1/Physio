import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  eq,
  and,
  desc,
  count,
  sql,
  or,
  ilike,
  gte,
  lte,
  inArray,
} from 'drizzle-orm';
import { db } from '../../../database';
import {
  refunds,
  refundItems,
  payments,
  paymentItems,
  invoices,
  enrollments,
  courses,
  users,
  sessions,
  webinarRegistrations,
  certificateRequests,
  PAYMENT_STATUS,
  REFUND_STATUS,
  ENROLLMENT_STATUS,
  INVOICE_STATUS,
  CERTIFICATE_STATUS,
} from '../../../database/schema';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { toCsvString } from '../../../common/exports/csv.util';
import { GatewayFactory } from '../gateways/gateway.factory';
import { EmailService } from '../../email/email.service';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { RejectRefundDto } from '../dto/reject-refund.dto';
import { DiscountService } from './discount.service';
import { RefundPolicyService } from './refund-policy.service';
import { ZOOM_SERVICE, IZoomService } from '../../zoom/zoom.interface';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  // Merchant fee rates and partial-refund capability now come from the
  // finance-managed `system_settings.refund_policy` row via
  // [[RefundPolicyService]]. The customer always receives the full refund
  // amount we send to the gateway; the merchant fee is the cost WE bear,
  // reconciled by the gateway on our next settlement.

  constructor(
    private readonly configService: ConfigService,
    private readonly gatewayFactory: GatewayFactory,
    private readonly auditLogService: AuditLogService,
    private readonly emailService: EmailService,
    private readonly discountService: DiscountService,
    private readonly refundPolicyService: RefundPolicyService,
    @Inject(ZOOM_SERVICE) private readonly zoomService: IZoomService,
  ) {
    // ConfigService kept on the signature for backward compatibility
    // with any callers that may still rely on prior wiring. The tabby
    // override is now configured via the policy row.
    void this.configService;
  }

  /**
   * Resolve the enrollment id that drives refund-policy gating + enrollment
   * revocation for a payment. Single-line gateway flows store it on
   * payments.enrollment_id directly. Multi-line cart payments (bank-transfer
   * drafts, cart checkouts) leave that column null and put per-line ids on
   * payment_items — fall back to the first one so policy still applies.
   */
  private async resolvePrimaryEnrollmentId(
    paymentId: string,
    paymentEnrollmentId: string | null,
  ): Promise<string | null> {
    if (paymentEnrollmentId) return paymentEnrollmentId;
    const [firstItem] = await db
      .select({ enrollmentId: paymentItems.enrollmentId })
      .from(paymentItems)
      .where(
        and(
          eq(paymentItems.paymentId, paymentId),
          sql`${paymentItems.enrollmentId} IS NOT NULL`,
        ),
      )
      .limit(1);
    return firstItem?.enrollmentId ?? null;
  }

  /**
   * Build the line-by-line refund breakdown for a payment. VAT and any
   * coupon discount are apportioned by each line's subtotal share so totals
   * reconcile back to the original payment.amount (within ≤0.01 SAR
   * rounding drift). For single-course legacy payments without
   * payment_items rows, fabricates a single virtual line so downstream
   * math stays uniform.
   *
   * Public so the payment-detail endpoints (admin + student) can reuse
   * the exact same line projection the refund preview and refund POST
   * see — single source of truth, no drift between what the buyer is
   * shown and what gets refunded.
   */
  async getPaymentLineBreakdown(paymentId: string): Promise<{
    lines: Array<{
      paymentItemId: string | null;
      courseId: string;
      courseTitle: string | null;
      courseTitleAr: string | null;
      enrollmentId: string | null;
      enrollmentStatus: string | null;
      unitPrice: number;
      lineSubtotal: number;
      lineDiscount: number;
      lineVat: number;
      lineTotal: number;
      refundedByRefundId: string | null;
    }>;
    totals: {
      subtotal: number;
      discount: number;
      vat: number;
      total: number;
    };
  }> {
    const [payment] = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        courseId: payments.courseId,
        metadata: payments.metadata,
        enrollmentId: payments.enrollmentId,
      })
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    const items = await db
      .select({
        id: paymentItems.id,
        courseId: paymentItems.courseId,
        enrollmentId: paymentItems.enrollmentId,
        unitPrice: paymentItems.unitPrice,
        salePrice: paymentItems.salePrice,
        discountAmount: paymentItems.discountAmount,
        lineTotal: paymentItems.lineTotal,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        enrollmentStatus: enrollments.status,
      })
      .from(paymentItems)
      .leftJoin(courses, eq(paymentItems.courseId, courses.id))
      .leftJoin(
        enrollments,
        eq(paymentItems.enrollmentId, enrollments.id),
      )
      .where(eq(paymentItems.paymentId, paymentId));

    // Track which payment_items have been refunded by a COMPLETED refund —
    // these get badged "Refunded" in the UI and rejected if re-selected.
    const refundedRows = await db
      .select({
        paymentItemId: refundItems.paymentItemId,
        refundId: refundItems.refundId,
        refundStatus: refunds.status,
      })
      .from(refundItems)
      .innerJoin(refunds, eq(refunds.id, refundItems.refundId))
      .where(
        and(
          eq(refunds.paymentId, paymentId),
          sql`${refunds.status} IN ('completed','pending','approved','processing')`,
        ),
      );
    const refundedItemMap = new Map<string, string>();
    for (const r of refundedRows) {
      // First-write-wins; a payment_item can only be in one in-flight refund.
      if (!refundedItemMap.has(r.paymentItemId)) {
        refundedItemMap.set(r.paymentItemId, r.refundId);
      }
    }

    const totalPaymentAmount = Number(payment.amount);
    const meta = (payment.metadata || {}) as Record<string, unknown>;
    const totalVat = numFromMeta(meta.taxAmount) ?? 0;
    const totalDiscount = numFromMeta(meta.discountAmount) ?? 0;
    const totalSubtotal =
      numFromMeta(meta.subtotal) ?? totalPaymentAmount - totalVat + totalDiscount;

    if (items.length === 0) {
      // Legacy single-course payment with no payment_items rows. Fabricate
      // one line so downstream code never branches on "have lines / don't".
      // courseId comes off payments; refundedItemId is N/A because there's
      // no payment_item to key on — these payments only support full refund.
      const [course] = payment.courseId
        ? await db
            .select({ id: courses.id, title: courses.title, titleAr: courses.titleAr })
            .from(courses)
            .where(eq(courses.id, payment.courseId))
            .limit(1)
        : [undefined];
      let enrollmentStatus: string | null = null;
      if (payment.enrollmentId) {
        const [enr] = await db
          .select({ status: enrollments.status })
          .from(enrollments)
          .where(eq(enrollments.id, payment.enrollmentId))
          .limit(1);
        enrollmentStatus = enr?.status ?? null;
      }
      return {
        lines: [
          {
            paymentItemId: null,
            courseId: payment.courseId,
            courseTitle: course?.title ?? null,
            courseTitleAr: course?.titleAr ?? null,
            enrollmentId: payment.enrollmentId,
            enrollmentStatus,
            unitPrice: totalSubtotal,
            lineSubtotal: totalSubtotal,
            lineDiscount: totalDiscount,
            lineVat: totalVat,
            lineTotal: totalPaymentAmount,
            refundedByRefundId: null,
          },
        ],
        totals: {
          subtotal: totalSubtotal,
          discount: totalDiscount,
          vat: totalVat,
          total: totalPaymentAmount,
        },
      };
    }

    // Apportion VAT + coupon discount by each line's gross subtotal share.
    // We use salePrice (after course-level sale, before coupon) as the base
    // — line_total already nets the per-line coupon allocation, but the
    // payment-level totals (taxAmount / discountAmount) were computed
    // pre-allocation so apportioning by sale_price keeps the math
    // consistent with how it was originally calculated at checkout.
    const grossSubtotalSum = items.reduce(
      (sum, it) => sum + Number(it.salePrice),
      0,
    );
    const lines = items.map((it) => {
      const linePreDiscount = Number(it.salePrice);
      const lineCouponShare = Number(it.discountAmount);
      const share =
        grossSubtotalSum > 0 ? linePreDiscount / grossSubtotalSum : 0;
      // Apportion any payment-level VAT and any payment-level coupon over and
      // above what's already on the line (payment_items.discountAmount
      // captures the per-line coupon allocation; in case the payment
      // metadata records a different total — e.g. campaign-level discount —
      // we apportion the delta).
      const lineVat = round2(totalVat * share);
      const apportionedDiscount = round2(totalDiscount * share);
      const effectiveDiscount = Math.max(lineCouponShare, apportionedDiscount);
      const lineTotal = round2(
        linePreDiscount - lineCouponShare + lineVat,
      );
      return {
        paymentItemId: it.id,
        courseId: it.courseId,
        courseTitle: it.courseTitle,
        courseTitleAr: it.courseTitleAr,
        enrollmentId: it.enrollmentId,
        enrollmentStatus: it.enrollmentStatus,
        unitPrice: Number(it.unitPrice),
        lineSubtotal: linePreDiscount,
        lineDiscount: effectiveDiscount,
        lineVat,
        lineTotal,
        refundedByRefundId: refundedItemMap.get(it.id) ?? null,
      };
    });

    // Distribute any rounding drift to the largest line so the sum
    // reconciles to the payment.amount. Keeps gateway totals exact.
    const linesSum = lines.reduce((s, l) => s + l.lineTotal, 0);
    const drift = round2(totalPaymentAmount - linesSum);
    if (Math.abs(drift) >= 0.01 && lines.length > 0) {
      const largest = lines.reduce(
        (a, b) => (b.lineTotal > a.lineTotal ? b : a),
        lines[0],
      );
      largest.lineTotal = round2(largest.lineTotal + drift);
    }

    return {
      lines,
      totals: {
        subtotal: totalSubtotal,
        discount: totalDiscount,
        vat: totalVat,
        total: totalPaymentAmount,
      },
    };
  }

  /**
   * Narrow the full line breakdown down to whichever lines the caller
   * actually wants to refund. Rejects any line that was already covered
   * by a completed/in-flight refund, and (if explicit ids were passed)
   * rejects unknown ids so a tampered request fails loudly instead of
   * silently refunding nothing.
   */
  private pickRefundableLines<
    T extends {
      paymentItemId: string | null;
      refundedByRefundId: string | null;
    },
  >(allLines: T[], explicitIds?: string[]): T[] {
    const refundable = allLines.filter((l) => l.refundedByRefundId === null);
    if (refundable.length === 0) {
      throw new BadRequestException(
        'No payment lines remain that can be refunded — every line has already been refunded.',
      );
    }
    if (!explicitIds || explicitIds.length === 0) {
      return refundable;
    }
    // Legacy single-course payments produce one line with paymentItemId
    // === null — they can't be partially refunded by item id (there's no
    // id to key on). Caller passing explicit ids against such a payment
    // is a bad request.
    if (refundable.every((l) => l.paymentItemId === null)) {
      throw new BadRequestException(
        'This payment has no per-line items — refund the full amount instead.',
      );
    }
    const idSet = new Set(explicitIds);
    const selected = refundable.filter(
      (l) => l.paymentItemId !== null && idSet.has(l.paymentItemId),
    );
    if (selected.length !== explicitIds.length) {
      throw new BadRequestException(
        'One or more selected items is already refunded or does not belong to this payment.',
      );
    }
    return selected;
  }

  /**
   * Insert refund_items rows tying a newly-created refund to the lines it
   * covers. Skips lines with paymentItemId === null (legacy single-course
   * payments) — those have no payment_items row to reference; the cascade
   * reader falls back to payments.enrollmentId.
   */
  private async insertRefundItemsForLines(
    refundId: string,
    lines: Array<{
      paymentItemId: string | null;
      courseId: string;
      enrollmentId: string | null;
      lineSubtotal: number;
      lineDiscount: number;
      lineVat: number;
      lineTotal: number;
    }>,
  ): Promise<void> {
    const insertable = lines.filter((l) => l.paymentItemId !== null);
    if (insertable.length === 0) return;
    await db.insert(refundItems).values(
      insertable.map((l) => ({
        refundId,
        paymentItemId: l.paymentItemId as string,
        courseId: l.courseId,
        enrollmentId: l.enrollmentId,
        lineAmount: l.lineSubtotal.toFixed(2),
        lineVat: l.lineVat.toFixed(2),
        lineDiscount: l.lineDiscount.toFixed(2),
        lineTotal: l.lineTotal.toFixed(2),
      })),
    );
  }

  /**
   * Compute the refund math for a given payment and requested refund
   * amount. Single source of truth for both `requestRefund` (student),
   * `adminInitiateRefund` (finance), and `getRefundPreview` (UI).
   *
   * Reads per-gateway deduction + partial-refund capability from
   * [[RefundPolicyService]] so finance can adjust without redeploy.
   *
   * Throws BadRequestException when the requested amount violates the
   * gateway's partial-refund capability.
   */
  private async computeRefundMath(
    gateway: string,
    originalAmount: number,
    requestedAmount?: number,
  ): Promise<{
    refundAmount: number;
    merchantFeeAmount: number;
    merchantFeeRate: number;
    merchantFeeReason: string | null;
    isPartial: boolean;
    partialRefundCapable: boolean;
  }> {
    const safeOriginal = Number(originalAmount.toFixed(2));
    const requested =
      requestedAmount === undefined || requestedAmount === null
        ? safeOriginal
        : Number(Number(requestedAmount).toFixed(2));

    if (requested <= 0) {
      throw new BadRequestException('Refund amount must be greater than 0');
    }
    if (requested > safeOriginal) {
      throw new BadRequestException(
        `Refund amount cannot exceed original payment (${safeOriginal})`,
      );
    }

    const policy = await this.refundPolicyService.getPolicy();
    const { deductionPercent, partialRefundCapable } =
      this.refundPolicyService.resolveForGateway(policy, gateway);

    const isPartial = requested < safeOriginal;
    if (isPartial && !partialRefundCapable) {
      throw new BadRequestException(
        `Partial refunds are not supported for ${gateway}. Send the full amount or change gateway.`,
      );
    }

    const merchantFeeRate = deductionPercent / 100;
    // Merchant fee is calculated on the REFUNDED amount, not the original
    // — Tamara/Tabby retain a proportional fee on what was refunded.
    const merchantFeeAmount = Number((requested * merchantFeeRate).toFixed(2));

    const gatewayLabels: Record<string, string> = {
      tamara: 'Tamara BNPL',
      tabby: 'Tabby BNPL',
    };
    const merchantFeeReason =
      merchantFeeAmount > 0
        ? `${gatewayLabels[gateway] || gateway} ${deductionPercent}% merchant fee (reconciled on settlement, NOT deducted from customer)`
        : null;

    return {
      refundAmount: requested,
      merchantFeeAmount,
      merchantFeeRate,
      merchantFeeReason,
      isPartial,
      partialRefundCapable,
    };
  }

  async requestRefund(userId: string, dto: CreateRefundDto, ipAddress?: string) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(eq(payments.id, dto.paymentId), eq(payments.userId, userId)),
      )
      .limit(1);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PAYMENT_STATUS.PAID) {
      throw new BadRequestException('Only paid payments can be refunded');
    }

    // Block if ANY pending/approved/processing refund is already in flight
    // for this payment. We DO allow a second refund AFTER a completed
    // partial refund — that's the per-course refund workflow (refund
    // course A today, then course B next week). When a new refund
    // arrives, the line-selection logic below excludes any payment_items
    // an earlier completed refund already covered, so a buyer can't
    // double-claim a course.
    const [existingRefund] = await db
      .select()
      .from(refunds)
      .where(
        and(
          eq(refunds.paymentId, dto.paymentId),
          sql`${refunds.status} IN ('pending', 'approved', 'processing')`,
        ),
      )
      .limit(1);

    if (existingRefund) {
      throw new BadRequestException(
        'A refund is already in progress for this payment',
      );
    }

    // Block if ANY prior refund for this payment was rejected. Students
    // can't self-serve a re-request once finance has said no — otherwise
    // the same case gets re-reviewed forever. Admin re-opens by calling
    // /refunds/admin-initiate directly (which does not run this check).
    // The UI already hides the button once refundability.canRequest is
    // false; this is the server-side belt-and-suspenders so a direct
    // POST from a spoofed client can't slip through.
    const [rejectedRefund] = await db
      .select({ id: refunds.id })
      .from(refunds)
      .where(
        and(
          eq(refunds.paymentId, dto.paymentId),
          eq(refunds.status, 'rejected'),
        ),
      )
      .limit(1);

    if (rejectedRefund) {
      throw new BadRequestException(
        'A previous refund request for this payment was rejected. Please contact support if you believe this decision should be reconsidered.',
      );
    }

    // Policy eligibility check — student requests must clear the
    // finance-managed lifecycle gates (course not started, no attendance,
    // no certificate). Bypassing is not allowed for student-initiated
    // requests; admin can override via adminInitiateRefund.
    // Resolves payments.enrollment_id OR the first payment_items.enrollment_id
    // so policy applies to multi-line cart purchases (bank-transfer drafts
    // and any cart checkout) the same way it applies to single-line ones.
    const policyEnrollmentId = await this.resolvePrimaryEnrollmentId(
      dto.paymentId,
      payment.enrollmentId,
    );
    if (policyEnrollmentId) {
      const eligibility = await this.refundPolicyService.checkEligibility(
        policyEnrollmentId,
      );
      if (!eligibility.eligible) {
        throw new BadRequestException(
          eligibility.reason ?? 'Refund is not allowed at this stage of the enrollment.',
        );
      }
    }

    // Resolve the line breakdown so we know which payment_items to refund
    // and what each line's apportioned VAT/discount/total is. If the
    // student selected a subset (multi-course cart with per-course
    // refund), narrow to those lines; otherwise refund every still-
    // refundable line.
    const breakdown = await this.getPaymentLineBreakdown(dto.paymentId);
    const selectedLines = this.pickRefundableLines(
      breakdown.lines,
      dto.paymentItemIds,
    );
    const refundedTotal = round2(
      selectedLines.reduce((s, l) => s + l.lineTotal, 0),
    );

    const originalAmount = Number(payment.amount);
    const { refundAmount, merchantFeeAmount, merchantFeeReason, isPartial } =
      await this.computeRefundMath(
        payment.gateway,
        originalAmount,
        refundedTotal,
      );

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.paymentId, dto.paymentId))
      .limit(1);

    const [refund] = await db
      .insert(refunds)
      .values({
        paymentId: dto.paymentId,
        invoiceId: invoice?.id || null,
        requestedBy: userId,
        reason: dto.reason,
        reasonNote: dto.reasonNote,
        originalAmount: originalAmount.toFixed(2),
        // Repurposed: deductionAmount now represents the MERCHANT FEE we
        // bear (reconciled via gateway settlement), NOT a deduction from
        // the customer. The customer always receives `refundAmount` in full.
        deductionAmount: merchantFeeAmount.toFixed(2),
        deductionReason: merchantFeeReason,
        refundAmount: refundAmount.toFixed(2),
        status: REFUND_STATUS.PENDING,
      })
      .returning();

    // Record which payment_items this refund covers. Single virtual lines
    // (legacy single-course payments without payment_items rows) have
    // paymentItemId === null — skip the insert for those, the cascade
    // reader falls back to payments.enrollmentId / courseId.
    await this.insertRefundItemsForLines(refund.id, selectedLines);
    void isPartial;

    try {
      await this.emailService.sendRefundRequested(userId, refund.id);
    } catch (err) {
      this.logger.error(`Failed to send refund requested email: ${err.message}`);
    }

    await this.auditLogService.log({
      entityType: 'refund',
      entityId: refund.id,
      action: 'refund_requested',
      performedBy: userId,
      ipAddress,
      metadata: {
        paymentId: dto.paymentId,
        reason: dto.reason,
        originalAmount,
        refundAmount,
        merchantFeeAmount,
        isPartial,
        paymentItemIds: dto.paymentItemIds ?? null,
        selectedCourseIds: selectedLines.map((l) => l.courseId),
      },
    });

    // Auto-approve gating — when the finance manager has enabled
    // auto-approval, run the approval immediately. If the gateway call
    // fails we leave the refund in whatever state approveRefund left it
    // (typically APPROVED, pending retry) and don't fail the student's
    // request — they get a created refund row either way.
    const policy = await this.refundPolicyService.getPolicy();
    if (policy.autoApproveEligible) {
      try {
        await this.approveRefund(
          refund.id,
          userId,
          ipAddress,
          'Auto-approved per refund policy',
        );
      } catch (err) {
        this.logger.warn(
          `Auto-approve failed for refund ${refund.id}: ${err.message}. Left for manual review.`,
        );
      }
    }

    return refund;
  }

  async approveRefund(
    refundId: string,
    processedBy: string,
    ipAddress?: string,
    approvalNote?: string,
    approvedAmount?: number,
  ) {
    const [refund] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.id, refundId))
      .limit(1);

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (
      refund.status !== REFUND_STATUS.PENDING &&
      refund.status !== REFUND_STATUS.APPROVED
    ) {
      throw new BadRequestException('Only pending or approved refunds can be approved');
    }

    // Get the payment to call the gateway
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, refund.paymentId))
      .limit(1);

    if (!payment || !payment.gatewayChargeId) {
      throw new BadRequestException('Payment or charge ID not found');
    }

    // Approve-time amount override. The requested amount is the ceiling:
    // admin can approve LESS than requested (partial approval, e.g. student
    // asked for 300 SAR and we approve 150), but never more. When reducing,
    // approvalNote is mandatory — audit + email need the reason. The
    // original requested amount is snapshotted into refund.metadata so we
    // can display "asked for X, approved for Y" in the email and audit.
    const requestedAmount = Number(refund.refundAmount);
    let finalRefundAmount = requestedAmount;
    let finalMerchantFee = Number(refund.deductionAmount);
    let finalMerchantFeeReason = refund.deductionReason;
    let isPartialApproval = false;
    if (approvedAmount !== undefined && approvedAmount !== null) {
      if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
        throw new BadRequestException(
          'Approved amount must be a positive number',
        );
      }
      if (approvedAmount > requestedAmount) {
        throw new BadRequestException(
          `Approved amount (${approvedAmount}) cannot exceed the requested amount (${requestedAmount})`,
        );
      }
      // Only treat as partial when the amounts actually differ (guard for
      // floating-point noise).
      if (Math.abs(approvedAmount - requestedAmount) > 0.005) {
        if (!approvalNote || !approvalNote.trim()) {
          throw new BadRequestException(
            'A reason (approvalNote) is required when approving a partial refund',
          );
        }
        const recomputed = await this.computeRefundMath(
          payment.gateway,
          Number(payment.amount),
          approvedAmount,
        );
        finalRefundAmount = recomputed.refundAmount;
        finalMerchantFee = recomputed.merchantFeeAmount;
        finalMerchantFeeReason = recomputed.merchantFeeReason;
        isPartialApproval = true;
      }
    }

    // Step 1: Persist the approval decision BEFORE calling the gateway.
    // This ensures the approved state is saved even if the gateway call fails,
    // allowing a retry without re-doing the Finance Manager approval.
    // If already APPROVED (retry path), skip re-writing approval timestamps.
    if (refund.status === REFUND_STATUS.PENDING) {
      await db
        .update(refunds)
        .set({
          status: REFUND_STATUS.APPROVED,
          processedBy,
          approvalNote: approvalNote || null,
          approvedAt: new Date(),
          refundAmount: finalRefundAmount.toFixed(2),
          deductionAmount: finalMerchantFee.toFixed(2),
          deductionReason: finalMerchantFeeReason,
          updatedAt: new Date(),
        })
        .where(eq(refunds.id, refundId));

      if (isPartialApproval) {
        // Audit log is the source of truth for the partial-approval
        // decision — refunds has no metadata column, so we snapshot the
        // requested vs approved amount + reason here. The refund-completed
        // email + admin UI both read this to render the "Partial approval"
        // block.
        await this.auditLogService.log({
          entityType: 'refund',
          entityId: refundId,
          action: 'refund_amount_adjusted_at_approval',
          performedBy: processedBy,
          ipAddress,
          metadata: {
            requestedAmount: requestedAmount.toFixed(2),
            approvedAmount: finalRefundAmount.toFixed(2),
            delta: (requestedAmount - finalRefundAmount).toFixed(2),
            reason: approvalNote,
          },
        });
      }

      // Re-read so the downstream gateway call uses the new amount snapshot.
      refund.refundAmount = finalRefundAmount.toFixed(2);
      refund.deductionAmount = finalMerchantFee.toFixed(2);
      refund.deductionReason = finalMerchantFeeReason;
    }

    // Step 2: Call gateway to initiate the actual refund transfer.
    // Pull the refund_items rows so we can hand Tabby its optional items[]
    // breakdown — surfaces in their merchant portal so ops can see WHICH
    // cart courses a partial refund covered. Other gateways ignore items.
    let gatewayRefundId: string | null = null;
    try {
      const refundLineRows = await db
        .select({
          courseId: refundItems.courseId,
          lineTotal: refundItems.lineTotal,
          courseTitle: courses.title,
        })
        .from(refundItems)
        .leftJoin(courses, eq(refundItems.courseId, courses.id))
        .where(eq(refundItems.refundId, refundId));
      const gatewayItems = refundLineRows.map((r) => ({
        referenceId: r.courseId,
        title: r.courseTitle || 'Course',
        unitPrice: Number(r.lineTotal),
        quantity: 1,
        category: 'Education',
      }));

      const gateway = this.gatewayFactory.getGateway(payment.gateway);
      const refundResult = await gateway.refund({
        gatewayChargeId: payment.gatewayChargeId,
        amount: Number(refund.refundAmount),
        reason: refund.reason,
        refundId,
        ...(gatewayItems.length > 0 ? { items: gatewayItems } : {}),
      });

      gatewayRefundId = refundResult.refundId;

      // Step 3: Mark as processing once gateway accepted it
      await db
        .update(refunds)
        .set({
          status: REFUND_STATUS.PROCESSING,
          gatewayRefundId: refundResult.refundId,
          updatedAt: new Date(),
        })
        .where(eq(refunds.id, refundId));

      // Auto-complete for gateways with no async settlement webhook. Mock has
      // no real provider; bank_transfer is an offline wire — finance has
      // already committed to executing it by approving the refund, so the
      // downstream cascade (drop enrollment, revoke certificate, reverse
      // discount, cancel future webinar regs) must run NOW rather than
      // wait for a webhook that never arrives. The actual wire is recorded
      // outside the system.
      //
      // Additionally, honour the gateway's own terminal status from the sync
      // refund response — Tabby returns SUCCEEDED inline (especially in
      // sandbox where no real money moves and no separate webhook fires);
      // Moyasar returns `refunded`; Tamara's simplified-refund endpoint
      // returns `approved` (full refund accepted) or `partially_refunded`
      // (the response Amna's per-course Tamara test hit and that left the
      // larger refund stuck in PROCESSING because we didn't recognise it).
      // All of these mean "Tamara/the gateway accepted the refund and the
      // money is moving" — completeRefund's cascade is safe to run.
      const terminalSuccess = new Set([
        'succeeded',
        'refunded',
        'completed',
        'fully_refunded',
        'approved',
        'partially_refunded',
      ]);
      const syncStatus = (refundResult.status || '').toLowerCase();
      if (
        payment.gateway === 'mock' ||
        payment.gateway === 'bank_transfer' ||
        terminalSuccess.has(syncStatus)
      ) {
        await this.completeRefund(refundId);
      }
    } catch (err) {
      // Gateway call failed — refund stays in APPROVED state for retry.
      this.logger.error(
        `Gateway refund call failed for refund ${refundId}: ${err.message}. Refund stays in APPROVED state for retry.`,
      );
      throw new BadRequestException(
        `Refund approved but gateway call failed: ${err.message}. Please retry the gateway call.`,
      );
    }

    // Send approval email
    try {
      await this.emailService.sendRefundApproved(refund.requestedBy, refundId);
    } catch (err) {
      this.logger.error(`Failed to send refund approved email: ${err.message}`);
    }

    await this.auditLogService.log({
      entityType: 'refund',
      entityId: refundId,
      action: 'refund_approved',
      performedBy: processedBy,
      ipAddress,
      metadata: {
        gatewayRefundId,
        refundAmount: refund.refundAmount,
        ...(approvalNote ? { approvalNote } : {}),
        ...(isPartialApproval
          ? {
              partialApproval: true,
              requestedAmount: requestedAmount.toFixed(2),
              approvedAmount: finalRefundAmount.toFixed(2),
            }
          : {}),
      },
    });

    return { status: 'approved', gatewayRefundId, partialApproval: isPartialApproval };
  }

  async rejectRefund(
    refundId: string,
    processedBy: string,
    dto: RejectRefundDto,
    ipAddress?: string,
  ) {
    const [refund] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.id, refundId))
      .limit(1);

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    // Allow rejection of PENDING or APPROVED (gateway call not yet succeeded) refunds
    if (
      refund.status !== REFUND_STATUS.PENDING &&
      refund.status !== REFUND_STATUS.APPROVED
    ) {
      throw new BadRequestException('Only pending or approved refunds can be rejected');
    }

    await db
      .update(refunds)
      .set({
        status: REFUND_STATUS.REJECTED,
        processedBy,
        rejectedAt: new Date(),
        rejectionNote: dto.rejectionNote,
        updatedAt: new Date(),
      })
      .where(eq(refunds.id, refundId));

    // Send rejection email
    try {
      await this.emailService.sendRefundRejected(
        refund.requestedBy,
        refundId,
        dto.rejectionNote,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send refund rejected email: ${err.message}`,
      );
    }

    await this.auditLogService.log({
      entityType: 'refund',
      entityId: refundId,
      action: 'refund_rejected',
      performedBy: processedBy,
      ipAddress,
      metadata: { rejectionNote: dto.rejectionNote },
    });

    return { status: 'rejected' };
  }

  async completeRefund(refundId: string) {
    const [refund] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.id, refundId))
      .limit(1);

    if (!refund) return;

    // Pre-load the payment so we can use its enrollmentId inside the transaction
    // without mixing tx and db selects.
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, refund.paymentId))
      .limit(1);

    // Pre-load cascade targets OUTSIDE the transaction so the tx itself
    // stays tight (writes only). All filtering done up-front.
    //
    // Per Amna's Q3 Option A: revoke access on EVERY refund completion
    // (partial or full). The "partial credit while keeping access" use
    // case is intentionally not supported — partials are still a closed
    // door.
    const studentId = payment?.userId;

    // Per-course refund cascade. Prefer refund_items (the explicit list of
    // payment_items this refund covers); fall back to every payment_items
    // row for the payment only when refund_items is empty — that's the
    // legacy-data path for refunds created before this junction existed.
    // Without that fallback, every pre-migration refund would silently
    // stop dropping enrollments.
    const refundItemRows = await db
      .select({
        enrollmentId: refundItems.enrollmentId,
        courseId: refundItems.courseId,
      })
      .from(refundItems)
      .where(eq(refundItems.refundId, refundId));

    let lineRows: Array<{
      enrollmentId: string | null;
      courseId: string;
    }> = refundItemRows;
    if (lineRows.length === 0) {
      lineRows = await db
        .select({
          enrollmentId: paymentItems.enrollmentId,
          courseId: paymentItems.courseId,
        })
        .from(paymentItems)
        .where(eq(paymentItems.paymentId, refund.paymentId));
    }

    const enrollmentIdsToDrop = Array.from(
      new Set(
        [
          // Only include the payment-level enrollment when refund_items is
          // empty (legacy/full-refund) OR refund_items explicitly names it.
          // Otherwise a partial refund covering courses {B,C} on a payment
          // whose enrollmentId == enrollment(A) would incorrectly drop A.
          ...(refundItemRows.length === 0
            ? [payment?.enrollmentId]
            : []),
          ...lineRows.map((r) => r.enrollmentId),
        ].filter((id): id is string => Boolean(id)),
      ),
    );
    const courseIdsForRevocation = Array.from(
      new Set(
        [
          ...(refundItemRows.length === 0
            ? [payment?.courseId]
            : []),
          ...lineRows.map((r) => r.courseId),
        ].filter((id): id is string => Boolean(id)),
      ),
    );

    // Find future-dated WEBINAR sessions for the refunded courses (we only
    // cancel upcoming attendance — past sessions already happened). Pull
    // the Zoom webinar ID so we can revoke at the Zoom layer after the DB
    // commit (defense-in-depth: even if a refunded learner has their join
    // URL cached, Zoom denies entry).
    const futureWebinarSessions =
      courseIdsForRevocation.length > 0 && studentId
        ? await db
            .select({
              id: sessions.id,
              zoomWebinarId: sessions.zoomWebinarId,
            })
            .from(sessions)
            .where(
              and(
                inArray(sessions.courseId, courseIdsForRevocation),
                gte(sessions.scheduledAt, new Date()),
              ),
            )
        : [];
    const futureSessionIds = futureWebinarSessions.map((s) => s.id);
    const sessionToZoomWebinar = new Map(
      futureWebinarSessions
        .filter((s) => !!s.zoomWebinarId)
        .map((s) => [s.id, s.zoomWebinarId as string]),
    );

    // Pre-load the (zoomRegistrantId, email) for each registration we're
    // about to cancel so we can call Zoom AFTER the DB commit.
    const registrationsToCancelOnZoom =
      studentId && futureSessionIds.length > 0
        ? await db
            .select({
              sessionId: webinarRegistrations.sessionId,
              zoomRegistrantId: webinarRegistrations.zoomRegistrantId,
              email: webinarRegistrations.email,
            })
            .from(webinarRegistrations)
            .where(
              and(
                eq(webinarRegistrations.userId, studentId),
                inArray(webinarRegistrations.sessionId, futureSessionIds),
                sql`${webinarRegistrations.status} <> 'cancelled'`,
              ),
            )
        : [];

    // Cascade summary for the audit log
    const cascade = {
      enrollmentDropped: false,
      webinarRegistrationsCancelled: 0,
      certificateRevoked: false,
      zoomRegistrantsCancelled: 0,
      zoomRegistrantsFailed: 0,
    };
    // Lifted out of the tx so post-commit branches (discount reversal,
    // audit log) can read the final verdict.
    let allLinesRefundedOut = false;

    await db.transaction(async (tx) => {
      // Update refund to completed
      await tx
        .update(refunds)
        .set({
          status: REFUND_STATUS.COMPLETED,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(refunds.id, refundId));

      // Payment status: PARTIALLY_REFUNDED unless every payment_items
      // row is now covered by a completed refund (= the whole purchase is
      // unwound). Money-based comparison alone gets it wrong for per-line
      // refunds — e.g., refunding the larger of two unequal lines could
      // exceed half the payment in amount but still leave a course paid for.
      const originalAmount = Number(refund.originalAmount);
      const refundAmount = Number(refund.refundAmount);

      const [{ itemCount }] = await tx
        .select({ itemCount: sql<number>`COUNT(*)::int` })
        .from(paymentItems)
        .where(eq(paymentItems.paymentId, refund.paymentId));
      // After this commit there will be N completed refund_items rows.
      // Pre-count what's already completed plus what this refund now adds.
      const [{ refundedItemCount }] = await tx
        .select({
          refundedItemCount: sql<number>`COUNT(DISTINCT ${refundItems.paymentItemId})::int`,
        })
        .from(refundItems)
        .innerJoin(refunds, eq(refunds.id, refundItems.refundId))
        .where(
          and(
            eq(refunds.paymentId, refund.paymentId),
            sql`(${refunds.status} = 'completed' OR ${refunds.id} = ${refundId})`,
          ),
        );

      const allLinesRefunded =
        itemCount > 0
          ? refundedItemCount >= itemCount
          : refundAmount >= originalAmount;
      allLinesRefundedOut = allLinesRefunded;
      const paymentStatus = allLinesRefunded
        ? PAYMENT_STATUS.REFUNDED
        : PAYMENT_STATUS.PARTIALLY_REFUNDED;

      await tx
        .update(payments)
        .set({
          status: paymentStatus,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, refund.paymentId));

      // Invoice status mirrors payment status — REFUNDED on a full
      // unwind, PARTIALLY_REFUNDED on a per-course refund. Leaving it as
      // 'paid' (the old behaviour) made the invoice list misleadingly
      // show "Paid" for invoices the buyer had already been partially
      // refunded on.
      if (refund.invoiceId) {
        await tx
          .update(invoices)
          .set({
            status: allLinesRefunded
              ? INVOICE_STATUS.REFUNDED
              : INVOICE_STATUS.PARTIALLY_REFUNDED,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, refund.invoiceId));
      }

      // 1. Drop every enrollment tied to this payment (multi-line cart
      // payments have one per line, single-line gateway payments have one
      // on payment.enrollmentId). Either path feeds enrollmentIdsToDrop.
      if (enrollmentIdsToDrop.length > 0) {
        await tx
          .update(enrollments)
          .set({ status: ENROLLMENT_STATUS.DROPPED })
          .where(inArray(enrollments.id, enrollmentIdsToDrop));
        cascade.enrollmentDropped = true;
      }

      // 2. Cancel future webinar registrations for this student
      if (studentId && futureSessionIds.length > 0) {
        const cancelled = await tx
          .update(webinarRegistrations)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(
            and(
              eq(webinarRegistrations.userId, studentId),
              inArray(webinarRegistrations.sessionId, futureSessionIds),
              sql`${webinarRegistrations.status} <> 'cancelled'`,
            ),
          )
          .returning({ id: webinarRegistrations.id });
        cascade.webinarRegistrationsCancelled = cancelled.length;
      }

      // 3. Revoke certificate eligibility (covers CME/CPD — the certificate
      // IS the CME credential; there is no separate CME table) for every
      // course in the refunded payment, not just the primary.
      if (courseIdsForRevocation.length > 0 && studentId) {
        const revoked = await tx
          .update(certificateRequests)
          .set({
            status: CERTIFICATE_STATUS.REVOKED,
            revokedBy: refund.processedBy || null,
            revokedAt: new Date(),
            revocationReason: `Course refunded — eligibility revoked (refund ${refundId})`,
          })
          .where(
            and(
              inArray(certificateRequests.courseId, courseIdsForRevocation),
              eq(certificateRequests.studentId, studentId),
              sql`${certificateRequests.status} <> 'revoked'`,
            ),
          )
          .returning({ id: certificateRequests.id });
        cascade.certificateRevoked = revoked.length > 0;
      }
    });

    // Reverse discount usage so the coupon can be reused — only on a
    // full unwind. A partial refund leaves the coupon "used" because the
    // buyer kept at least one course the coupon was applied against;
    // reversing would let them reuse the coupon AND keep the discounted
    // course.
    if (allLinesRefundedOut) {
      try {
        await this.discountService.reverseUsage(refund.paymentId);
      } catch (err) {
        this.logger.error(
          `Failed to reverse discount usage for payment ${refund.paymentId}: ${err.message}`,
        );
      }
    }

    // Zoom-side registrant cancellation — best-effort, runs AFTER the DB
    // commit so the DB cancellation stands even if Zoom is down. This is
    // the defence-in-depth layer: stops a learner who has the join URL
    // cached/bookmarked from entering the webinar via Zoom.
    for (const reg of registrationsToCancelOnZoom) {
      const zoomWebinarId = sessionToZoomWebinar.get(reg.sessionId);
      if (!zoomWebinarId || !reg.zoomRegistrantId) continue;
      try {
        const res = await this.zoomService.cancelWebinarRegistrant(
          zoomWebinarId,
          reg.zoomRegistrantId,
          reg.email,
        );
        if (res.ok) cascade.zoomRegistrantsCancelled += 1;
        else cascade.zoomRegistrantsFailed += 1;
      } catch (err: any) {
        this.logger.warn(
          `Zoom cancel registrant threw for refund ${refundId}: ${err?.message || err}`,
        );
        cascade.zoomRegistrantsFailed += 1;
      }
    }

    // Send completion email
    try {
      await this.emailService.sendRefundCompleted(
        refund.requestedBy,
        refundId,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send refund completed email: ${err.message}`,
      );
    }

    await this.auditLogService.log({
      entityType: 'refund',
      entityId: refundId,
      action: 'refund_completed',
      performedBy: 'system',
      ipAddress: 'system-webhook',
      metadata: {
        paymentId: refund.paymentId,
        refundAmount: refund.refundAmount,
        merchantFeeAmount: refund.deductionAmount,
        cascade,
      },
    });
  }

  async getMyRefunds(userId: string, page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const refundsList = await db
      .select({
        id: refunds.id,
        paymentId: refunds.paymentId,
        reason: refunds.reason,
        reasonNote: refunds.reasonNote,
        originalAmount: refunds.originalAmount,
        deductionAmount: refunds.deductionAmount,
        refundAmount: refunds.refundAmount,
        status: refunds.status,
        createdAt: refunds.createdAt,
        approvedAt: refunds.approvedAt,
        completedAt: refunds.completedAt,
        rejectedAt: refunds.rejectedAt,
        rejectionNote: refunds.rejectionNote,
      })
      .from(refunds)
      .where(eq(refunds.requestedBy, userId))
      .orderBy(desc(refunds.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(refunds)
      .where(eq(refunds.requestedBy, userId));

    return {
      data: refundsList,
      pagination: {
        page,
        limit,
        total: Number(totalResult?.count || 0),
        totalPages: Math.ceil(Number(totalResult?.count || 0) / limit),
      },
    };
  }

  private readonly refundSelectFields = {
    id: refunds.id,
    paymentId: refunds.paymentId,
    requesterName: sql<string>`CONCAT(requester.first_name, ' ', requester.last_name)`,
    requesterEmail: sql<string>`requester.email`,
    // Course title = the FIRST course the refund actually covers (via
    // refund_items → courses). For multi-course refunds, the UI uses
    // refundedCourseCount to render "(+N more)". Falls back to
    // payments.courseId for genuinely-empty refund_items rows.
    //
    // Implemented as scalar subqueries instead of LATERAL because drizzle's
    // sql template doesn't compose cleanly into leftJoin; subqueries here
    // are 1:1 per refund and the refund_items index makes them cheap.
    courseTitle: sql<string | null>`COALESCE(
      (SELECT c.title FROM ${refundItems} ri JOIN ${courses} c ON c.id = ri.course_id
       WHERE ri.refund_id = ${refunds.id}
       ORDER BY ri.created_at ASC, c.title ASC LIMIT 1),
      ${courses.title}
    )`,
    courseTitleAr: sql<string | null>`COALESCE(
      (SELECT c.title_ar FROM ${refundItems} ri JOIN ${courses} c ON c.id = ri.course_id
       WHERE ri.refund_id = ${refunds.id}
       ORDER BY ri.created_at ASC, c.title ASC LIMIT 1),
      ${courses.titleAr}
    )`,
    refundedCourseCount: sql<number>`COALESCE(
      (SELECT COUNT(DISTINCT ri.course_id)::int FROM ${refundItems} ri
       WHERE ri.refund_id = ${refunds.id}),
      0
    )`,
    gateway: payments.gateway,
    reason: refunds.reason,
    reasonNote: refunds.reasonNote,
    originalAmount: refunds.originalAmount,
    deductionAmount: refunds.deductionAmount,
    deductionReason: refunds.deductionReason,
    refundAmount: refunds.refundAmount,
    status: refunds.status,
    approvalNote: refunds.approvalNote,
    createdAt: refunds.createdAt,
    approvedAt: refunds.approvedAt,
    completedAt: refunds.completedAt,
    rejectedAt: refunds.rejectedAt,
    rejectionNote: refunds.rejectionNote,
    processedBy: refunds.processedBy,
    gatewayRefundId: refunds.gatewayRefundId,
  };

  private buildRefundBaseQuery() {
    return db
      .select(this.refundSelectFields)
      .from(refunds)
      .leftJoin(
        sql`${users} AS requester`,
        eq(refunds.requestedBy, sql`requester.id`),
      )
      .leftJoin(payments, eq(refunds.paymentId, payments.id))
      .leftJoin(courses, eq(payments.courseId, courses.id));
  }

  private buildRefundConditions(
    status?: string,
    search?: string,
    startDate?: string,
    endDate?: string,
    gateway?: string,
    reason?: string,
  ) {
    const conditions: any[] = [];
    if (status && status !== 'all') {
      conditions.push(eq(refunds.status, status));
    }
    if (gateway && gateway !== 'all') {
      conditions.push(eq(payments.gateway, gateway));
    }
    if (reason && reason !== 'all') {
      conditions.push(eq(refunds.reason, reason));
    }
    if (search) {
      conditions.push(
        or(
          ilike(sql`requester.email`, `%${search}%`),
          ilike(
            sql`CONCAT(requester.first_name, ' ', requester.last_name)`,
            `%${search}%`,
          ),
          ilike(courses.title, `%${search}%`),
        ),
      );
    }
    if (startDate) {
      conditions.push(gte(refunds.createdAt, new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(refunds.createdAt, end));
    }
    return conditions;
  }

  async getRefundById(refundId: string) {
    const [refund] = await this.buildRefundBaseQuery()
      .where(eq(refunds.id, refundId))
      .limit(1);

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    return refund;
  }

  async getAllRefunds(
    page: number = 1,
    limit: number = 10,
    status?: string,
    search?: string,
    startDate?: string,
    endDate?: string,
    gateway?: string,
    reason?: string,
  ) {
    const offset = (page - 1) * limit;
    const conditions = this.buildRefundConditions(
      status,
      search,
      startDate,
      endDate,
      gateway,
      reason,
    );
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const refundsList = await this.buildRefundBaseQuery()
      .where(whereClause)
      .orderBy(desc(refunds.createdAt))
      .limit(limit)
      .offset(offset);

    // Count uses the same joins (we filter on gateway via payments) but skips
    // search for performance.
    const countConditions = this.buildRefundConditions(
      status,
      undefined,
      startDate,
      endDate,
      gateway,
      reason,
    );
    const countWhere =
      countConditions.length > 0 ? and(...countConditions) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(refunds)
      .leftJoin(payments, eq(refunds.paymentId, payments.id))
      .where(countWhere);

    return {
      data: refundsList,
      pagination: {
        page,
        limit,
        total: Number(totalResult?.count || 0),
        totalPages: Math.ceil(Number(totalResult?.count || 0) / limit),
      },
    };
  }

  /**
   * Aggregate KPIs for the Refunds page header. Mirrors the
   * InvoiceService.getInvoiceSummary shape (single grouped query so the
   * page loads in one round-trip). Uses the SAME filter set as the table,
   * so summary always matches what the user sees.
   */
  async getRefundSummary(opts: {
    status?: string;
    startDate?: string;
    endDate?: string;
    gateway?: string;
    reason?: string;
  }) {
    const conditions = this.buildRefundConditions(
      opts.status,
      undefined,
      opts.startDate,
      opts.endDate,
      opts.gateway,
      opts.reason,
    );
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [row] = await db
      .select({
        totalCount: sql<number>`COUNT(*)::int`,
        pendingCount: sql<number>`COUNT(CASE WHEN ${refunds.status} = 'pending' THEN 1 END)::int`,
        approvedCount: sql<number>`COUNT(CASE WHEN ${refunds.status} = 'approved' THEN 1 END)::int`,
        processingCount: sql<number>`COUNT(CASE WHEN ${refunds.status} = 'processing' THEN 1 END)::int`,
        completedCount: sql<number>`COUNT(CASE WHEN ${refunds.status} = 'completed' THEN 1 END)::int`,
        rejectedCount: sql<number>`COUNT(CASE WHEN ${refunds.status} = 'rejected' THEN 1 END)::int`,
        failedCount: sql<number>`COUNT(CASE WHEN ${refunds.status} = 'failed' THEN 1 END)::int`,
        pendingAmount: sql<string>`COALESCE(SUM(CASE WHEN ${refunds.status} = 'pending' THEN ${refunds.refundAmount}::numeric ELSE 0 END), 0)`,
        inFlightAmount: sql<string>`COALESCE(SUM(CASE WHEN ${refunds.status} IN ('approved','processing') THEN ${refunds.refundAmount}::numeric ELSE 0 END), 0)`,
        grossRefundedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${refunds.status} = 'completed' THEN ${refunds.originalAmount}::numeric ELSE 0 END), 0)`,
        netRefundedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${refunds.status} = 'completed' THEN ${refunds.refundAmount}::numeric ELSE 0 END), 0)`,
        deductionCaptured: sql<string>`COALESCE(SUM(CASE WHEN ${refunds.status} = 'completed' THEN ${refunds.deductionAmount}::numeric ELSE 0 END), 0)`,
        avgResolutionHours: sql<string>`COALESCE(AVG(CASE WHEN ${refunds.status} = 'completed' AND ${refunds.completedAt} IS NOT NULL THEN EXTRACT(EPOCH FROM (${refunds.completedAt} - ${refunds.createdAt})) / 3600.0 END), 0)`,
      })
      .from(refunds)
      .leftJoin(payments, eq(refunds.paymentId, payments.id))
      .where(whereClause);

    // Refund rate BY AMOUNT (not count) — completed refund SAR / paid SAR
    // in the same window. Uses paidAt window when present.
    const dateConds: any[] = [];
    if (opts.startDate)
      dateConds.push(gte(payments.paidAt, new Date(opts.startDate)));
    if (opts.endDate) {
      const end = new Date(opts.endDate);
      end.setHours(23, 59, 59, 999);
      dateConds.push(lte(payments.paidAt, end));
    }
    if (opts.gateway && opts.gateway !== 'all')
      dateConds.push(eq(payments.gateway, opts.gateway));

    const [paidRow] = await db
      .select({
        paidAmount: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} IN ('paid','refunded','partially_refunded') THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
      })
      .from(payments)
      .where(dateConds.length > 0 ? and(...dateConds) : undefined);

    const netRefunded = Number(row?.netRefundedAmount ?? 0);
    const paidAmount = Number(paidRow?.paidAmount ?? 0);
    const refundRateByAmount =
      paidAmount > 0 ? Number(((netRefunded / paidAmount) * 100).toFixed(2)) : 0;

    return {
      totalCount: row?.totalCount ?? 0,
      pendingCount: row?.pendingCount ?? 0,
      approvedCount: row?.approvedCount ?? 0,
      processingCount: row?.processingCount ?? 0,
      completedCount: row?.completedCount ?? 0,
      rejectedCount: row?.rejectedCount ?? 0,
      failedCount: row?.failedCount ?? 0,
      pendingAmount: Number(row?.pendingAmount ?? 0),
      inFlightAmount: Number(row?.inFlightAmount ?? 0),
      grossRefundedAmount: Number(row?.grossRefundedAmount ?? 0),
      netRefundedAmount: netRefunded,
      deductionCaptured: Number(row?.deductionCaptured ?? 0),
      avgResolutionHours: Number(
        Number(row?.avgResolutionHours ?? 0).toFixed(1),
      ),
      refundRateByAmount,
      paidWindowAmount: paidAmount,
    };
  }

  /**
   * Full refund detail for the drawer: refund row + enriched payment/invoice
   * context + audit timeline. One round trip.
   */
  async getRefundDetail(refundId: string) {
    const [base] = await db
      .select({
        id: refunds.id,
        paymentId: refunds.paymentId,
        invoiceId: refunds.invoiceId,
        requestedBy: refunds.requestedBy,
        processedBy: refunds.processedBy,
        reason: refunds.reason,
        reasonNote: refunds.reasonNote,
        originalAmount: refunds.originalAmount,
        deductionAmount: refunds.deductionAmount,
        deductionReason: refunds.deductionReason,
        refundAmount: refunds.refundAmount,
        status: refunds.status,
        gatewayRefundId: refunds.gatewayRefundId,
        approvalNote: refunds.approvalNote,
        rejectionNote: refunds.rejectionNote,
        createdAt: refunds.createdAt,
        approvedAt: refunds.approvedAt,
        completedAt: refunds.completedAt,
        rejectedAt: refunds.rejectedAt,
        requesterName: sql<string>`CONCAT(requester.first_name, ' ', requester.last_name)`,
        requesterEmail: sql<string>`requester.email`,
        gateway: payments.gateway,
        paymentMethod: payments.paymentMethod,
        paymentStatus: payments.status,
        paymentAmount: payments.amount,
        gatewayChargeId: payments.gatewayChargeId,
        courseId: payments.courseId,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        invoiceNumber: invoices.invoiceNumber,
      })
      .from(refunds)
      .leftJoin(
        sql`${users} AS requester`,
        eq(refunds.requestedBy, sql`requester.id`),
      )
      .leftJoin(payments, eq(refunds.paymentId, payments.id))
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .leftJoin(invoices, eq(refunds.invoiceId, invoices.id))
      .where(eq(refunds.id, refundId))
      .limit(1);

    if (!base) {
      throw new NotFoundException('Refund not found');
    }

    let processorName: string | null = null;
    let processorEmail: string | null = null;
    if (base.processedBy) {
      const [proc] = await db
        .select({
          name: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, base.processedBy))
        .limit(1);
      processorName = proc?.name ?? null;
      processorEmail = proc?.email ?? null;
    }

    // Per-course refunded items so the refund drawer can list exactly
    // which courses were covered (instead of just the payment's first
    // course). Empty array = legacy refund without refund_items rows.
    const refundedItems = await db
      .select({
        paymentItemId: refundItems.paymentItemId,
        courseId: refundItems.courseId,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        lineAmount: refundItems.lineAmount,
        lineVat: refundItems.lineVat,
        lineDiscount: refundItems.lineDiscount,
        lineTotal: refundItems.lineTotal,
      })
      .from(refundItems)
      .leftJoin(courses, eq(courses.id, refundItems.courseId))
      .where(eq(refundItems.refundId, refundId));

    return {
      ...base,
      processorName,
      processorEmail,
      refundedItems,
    };
  }

  /**
   * Audit timeline for a refund: refund's own events + the parent payment's
   * lifecycle events. Same UNION pattern as InvoiceService.getInvoiceAudit
   * and PaymentsService.getPaymentAudit.
   */
  async getRefundAudit(refundId: string, limit: number = 100) {
    const [refund] = await db
      .select({ paymentId: refunds.paymentId })
      .from(refunds)
      .where(eq(refunds.id, refundId))
      .limit(1);
    if (!refund) return [];

    const cap = Math.min(limit, 200);
    const result = await db.execute(sql`
      SELECT a.id,
             a.action,
             a.entity_type AS "entityType",
             a.entity_id AS "entityId",
             a.performed_by AS "performedBy",
             a.metadata,
             a.created_at AS "createdAt",
             CASE
               WHEN u.id IS NULL THEN NULL
               ELSE CONCAT(u.first_name, ' ', u.last_name)
             END AS "actorName",
             u.email AS "actorEmail"
      FROM audit_logs a
      LEFT JOIN users u ON a.performed_by = u.id
      WHERE
        (a.entity_type = 'refund' AND a.entity_id = ${refundId})
        OR (a.entity_type = 'payment' AND a.entity_id = ${refund.paymentId})
      ORDER BY a.created_at DESC
      LIMIT ${cap}
    `);
    return result.rows as Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      performedBy: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: string;
      actorName: string | null;
      actorEmail: string | null;
    }>;
  }

  /**
   * Admin-initiated refund. Skips the userId ownership check (a Finance
   * agent is acting on the learner's behalf) but otherwise reuses the same
   * eligibility rules, deduction math, and audit trail as a learner-
   * initiated request. The audit metadata flags it as admin-initiated so
   * the timeline shows who authorised it.
   */
  async adminInitiateRefund(
    adminId: string,
    dto: CreateRefundDto & {
      justification?: string;
      /** Optional explicit refund amount override. Used only when the
       * admin is overriding the line-derived total (e.g. waiving a
       * partial portion). When omitted, the amount is summed from the
       * selected paymentItemIds (or the full payment if none selected). */
      refundAmount?: number;
      /** When true, the policy eligibility gate is bypassed. The bypass
       * (with the gate's reason) is recorded in the audit log. */
      bypassPolicy?: boolean;
    },
    ipAddress?: string,
  ) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, dto.paymentId))
      .limit(1);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PAYMENT_STATUS.PAID) {
      throw new BadRequestException('Only paid payments can be refunded');
    }

    const [existingRefund] = await db
      .select()
      .from(refunds)
      .where(
        and(
          eq(refunds.paymentId, dto.paymentId),
          sql`${refunds.status} IN ('pending', 'approved', 'processing')`,
        ),
      )
      .limit(1);

    if (existingRefund) {
      throw new BadRequestException(
        'A refund is already in progress for this payment',
      );
    }

    // Policy eligibility — admin can bypass with `bypassPolicy: true`.
    // The bypass + the underlying reason are captured in the audit log
    // so finance can see WHO overrode WHAT for compliance reviews.
    // Multi-line cart payments fall back to payment_items so admins still
    // see (and have to consciously bypass) the same policy on cart refunds.
    let bypassedBlockReason: string | null = null;
    const adminPolicyEnrollmentId = await this.resolvePrimaryEnrollmentId(
      dto.paymentId,
      payment.enrollmentId,
    );
    if (adminPolicyEnrollmentId) {
      const eligibility = await this.refundPolicyService.checkEligibility(
        adminPolicyEnrollmentId,
      );
      if (!eligibility.eligible) {
        if (!dto.bypassPolicy) {
          throw new BadRequestException(
            eligibility.reason ?? 'Refund is not allowed at this stage of the enrollment.',
          );
        }
        bypassedBlockReason = eligibility.reason ?? eligibility.blockedBy;
      }
    }

    const breakdown = await this.getPaymentLineBreakdown(dto.paymentId);
    const selectedLines = this.pickRefundableLines(
      breakdown.lines,
      dto.paymentItemIds,
    );
    const linesSum = round2(
      selectedLines.reduce((s, l) => s + l.lineTotal, 0),
    );

    const originalAmount = Number(payment.amount);
    // dto.refundAmount, when provided, is an admin override that wins
    // over the line-derived sum — used when finance wants to waive a
    // portion (e.g. SAR 50 goodwill against a SAR 200 line). We still
    // record the selected lines so the cascade drops the right
    // enrollments; the per-line monetary snapshot is the override-scaled
    // share.
    const requestedAmount = dto.refundAmount ?? linesSum;
    const { refundAmount, merchantFeeAmount, merchantFeeReason, isPartial } =
      await this.computeRefundMath(
        payment.gateway,
        originalAmount,
        requestedAmount,
      );

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.paymentId, dto.paymentId))
      .limit(1);

    const [refund] = await db
      .insert(refunds)
      .values({
        paymentId: dto.paymentId,
        invoiceId: invoice?.id || null,
        requestedBy: payment.userId,
        processedBy: adminId,
        reason: dto.reason,
        reasonNote: dto.reasonNote,
        originalAmount: originalAmount.toFixed(2),
        deductionAmount: merchantFeeAmount.toFixed(2),
        deductionReason: merchantFeeReason,
        refundAmount: refundAmount.toFixed(2),
        status: REFUND_STATUS.PENDING,
      })
      .returning();

    // Scale per-line snapshots when admin overrode the total so each
    // refund_items row sums back to the actual refundAmount. Without
    // scaling, a SAR 50 override on a SAR 200 line would record line
    // snapshot 200 + refund snapshot 50 — finance reports would diverge.
    const scale =
      linesSum > 0 && Math.abs(requestedAmount - linesSum) >= 0.01
        ? refundAmount / linesSum
        : 1;
    const scaledLines = selectedLines.map((l) => ({
      ...l,
      lineSubtotal: round2(l.lineSubtotal * scale),
      lineDiscount: round2(l.lineDiscount * scale),
      lineVat: round2(l.lineVat * scale),
      lineTotal: round2(l.lineTotal * scale),
    }));
    await this.insertRefundItemsForLines(refund.id, scaledLines);

    try {
      await this.emailService.sendRefundRequested(payment.userId, refund.id);
    } catch (err) {
      this.logger.error(
        `Failed to send refund requested email: ${err.message}`,
      );
    }

    await this.auditLogService.log({
      entityType: 'refund',
      entityId: refund.id,
      action: bypassedBlockReason
        ? 'refund_admin_initiated_policy_bypass'
        : 'refund_admin_initiated',
      performedBy: adminId,
      ipAddress,
      metadata: {
        paymentId: dto.paymentId,
        learnerId: payment.userId,
        reason: dto.reason,
        originalAmount,
        refundAmount,
        merchantFeeAmount,
        isPartial,
        justification: dto.justification || null,
        paymentItemIds: dto.paymentItemIds ?? null,
        selectedCourseIds: selectedLines.map((l) => l.courseId),
        ...(bypassedBlockReason
          ? { bypassedBlockReason }
          : {}),
      },
    });

    return refund;
  }

  /**
   * Mark an approved-but-stuck refund as terminally failed. Used by
   * Finance when the gateway call has failed repeatedly and the refund
   * cannot be processed automatically — typically followed by a manual
   * bank transfer recorded outside the system.
   */
  async markFailed(
    refundId: string,
    processedBy: string,
    note: string,
    ipAddress?: string,
  ) {
    const [refund] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.id, refundId))
      .limit(1);

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (
      refund.status !== REFUND_STATUS.APPROVED &&
      refund.status !== REFUND_STATUS.PROCESSING
    ) {
      throw new BadRequestException(
        'Only approved or processing refunds can be marked as failed',
      );
    }

    await db
      .update(refunds)
      .set({
        status: REFUND_STATUS.FAILED,
        processedBy,
        rejectionNote: note,
        updatedAt: new Date(),
      })
      .where(eq(refunds.id, refundId));

    await this.auditLogService.log({
      entityType: 'refund',
      entityId: refundId,
      action: 'refund_marked_failed',
      performedBy: processedBy,
      ipAddress,
      metadata: { note },
    });

    return { status: 'failed' };
  }

  /**
   * Full refund preview for a paid payment. Used by the Initiate Refund
   * modal's confirmation step so the operator sees the complete picture
   * (invoice + course + enrollment status + deduction breakdown + warning)
   * BEFORE submitting. Math is identical to adminInitiateRefund so the
   * preview is the single source of truth.
   */
  async getRefundPreview(
    paymentId: string,
    requestedAmount?: number,
    paymentItemIds?: string[],
  ) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (
      payment.status !== PAYMENT_STATUS.PAID &&
      payment.status !== PAYMENT_STATUS.PARTIALLY_REFUNDED
    ) {
      throw new BadRequestException(
        'Only paid (or partially-refunded) payments are eligible for a refund preview',
      );
    }

    const [existingRefund] = await db
      .select({
        id: refunds.id,
        status: refunds.status,
        createdAt: refunds.createdAt,
      })
      .from(refunds)
      .where(
        and(
          eq(refunds.paymentId, paymentId),
          // Block only in-flight refunds. Completed refunds are OK — we
          // allow a SECOND refund covering remaining (not-yet-refunded)
          // lines for per-course partial refunds.
          sql`${refunds.status} IN ('pending', 'approved', 'processing')`,
        ),
      )
      .limit(1);

    if (existingRefund) {
      throw new BadRequestException(
        `This payment already has a refund in progress (status: ${existingRefund.status})`,
      );
    }

    const [buyer] = await db
      .select({
        id: users.id,
        name: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, payment.userId))
      .limit(1);

    const [course] = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
      })
      .from(courses)
      .where(eq(courses.id, payment.courseId))
      .limit(1);

    const [invoice] = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        issuedAt: invoices.issuedAt,
        paidAt: invoices.paidAt,
      })
      .from(invoices)
      .where(eq(invoices.paymentId, paymentId))
      .limit(1);

    let enrollment: {
      id: string;
      status: string;
      enrolledAt: Date | null;
    } | null = null;
    if (payment.enrollmentId) {
      const [enr] = await db
        .select({
          id: enrollments.id,
          status: enrollments.status,
          enrolledAt: enrollments.enrolledAt,
        })
        .from(enrollments)
        .where(eq(enrollments.id, payment.enrollmentId))
        .limit(1);
      enrollment = enr || null;
    }

    // Build the line breakdown so the preview can show each cart course
    // with its own per-line refund amount. If a specific subset was
    // requested, narrow to those lines and use their sum as the default
    // refund amount; otherwise default to the full refundable total.
    const breakdown = await this.getPaymentLineBreakdown(paymentId);
    const refundableLines = breakdown.lines.filter(
      (l) => l.refundedByRefundId === null,
    );
    let selectedLines = refundableLines;
    if (paymentItemIds && paymentItemIds.length > 0) {
      const idSet = new Set(paymentItemIds);
      const filtered = refundableLines.filter(
        (l) => l.paymentItemId !== null && idSet.has(l.paymentItemId),
      );
      if (filtered.length > 0) selectedLines = filtered;
    }
    const linesSum = round2(
      selectedLines.reduce((s, l) => s + l.lineTotal, 0),
    );

    const originalAmount = Number(payment.amount);
    // Precedence: explicit requestedAmount > sum of selected lines >
    // refundable total. Lets the admin override per-line totals if they
    // need to waive part of a partial refund.
    const refundTargetAmount =
      requestedAmount !== undefined && requestedAmount !== null
        ? requestedAmount
        : linesSum;
    const {
      refundAmount,
      merchantFeeAmount,
      merchantFeeRate,
      merchantFeeReason,
      isPartial,
      partialRefundCapable,
    } = await this.computeRefundMath(
      payment.gateway,
      originalAmount,
      refundTargetAmount,
    );

    // Policy eligibility status for the UI — preview shows this so the
    // operator can see what's blocking BEFORE attempting the refund. Use
    // payment_items fallback so multi-line cart refunds show the same
    // policy verdict as single-line ones.
    const previewPolicyEnrollmentId = await this.resolvePrimaryEnrollmentId(
      payment.id,
      payment.enrollmentId,
    );
    const eligibility = previewPolicyEnrollmentId
      ? await this.refundPolicyService.checkEligibility(previewPolicyEnrollmentId)
      : { eligible: true, blockedBy: null, reason: null };

    const gatewayLabels: Record<string, string> = {
      tamara: 'Tamara BNPL',
      tabby: 'Tabby BNPL',
    };

    // For BNPL: refund goes back to the gateway, which adjusts the
    // learner's installments and refunds any installments already paid
    // back to the learner's card. For Moyasar: reverses on the same card.
    // For Bank Transfer: manual wire by finance team.
    const refundDestination = ((): {
      kind: 'gateway' | 'card' | 'manual_bank';
      label: string;
    } => {
      if (payment.gateway === 'tamara' || payment.gateway === 'tabby') {
        return {
          kind: 'gateway',
          label: `${gatewayLabels[payment.gateway]} — cancels remaining installments and refunds any installments already paid back to the learner's card`,
        };
      }
      if (payment.gateway === 'bank_transfer') {
        return {
          kind: 'manual_bank',
          label: "Manual bank wire by finance team to learner's account",
        };
      }
      return {
        kind: 'card',
        label: "Learner's original card via Moyasar (5–10 business days)",
      };
    })();

    // Maximum the operator can refund right now = sum of every still-
    // refundable line. On a payment with prior partial refunds this is
    // less than originalAmount.
    const maxRefundableNow = round2(
      refundableLines.reduce((s, l) => s + l.lineTotal, 0),
    );

    return {
      payment: {
        id: payment.id,
        amount: originalAmount,
        gateway: payment.gateway,
        paymentMethod: payment.paymentMethod,
        paidAt: payment.paidAt,
        gatewayChargeId: payment.gatewayChargeId,
      },
      buyer,
      course,
      invoice,
      enrollment,
      eligibility,
      capabilities: {
        supportsPartial: partialRefundCapable,
        maxRefundAmount: maxRefundableNow,
        minRefundAmount: partialRefundCapable ? 1 : maxRefundableNow,
      },
      // Per-course breakdown so the modal can render checkboxes. UI
      // disables already-refunded lines and badges them with the prior
      // refundId so finance can navigate to that refund's drawer.
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
        selected:
          paymentItemIds && paymentItemIds.length > 0
            ? l.paymentItemId !== null && paymentItemIds.includes(l.paymentItemId)
            : l.refundedByRefundId === null,
      })),
      selection: {
        paymentItemIds:
          paymentItemIds && paymentItemIds.length > 0
            ? paymentItemIds
            : selectedLines
                .map((l) => l.paymentItemId)
                .filter((id): id is string => id !== null),
        selectedTotal: linesSum,
        isFullPaymentRefund: selectedLines.length === breakdown.lines.length,
        isPartialCartRefund:
          selectedLines.length > 0 &&
          selectedLines.length < breakdown.lines.length,
      },
      breakdown: {
        originalAmount,
        refundAmount,
        merchantFeeRate,
        merchantFeeAmount,
        merchantFeeReason,
        isPartial,
      },
      refundDestination,
      consequences: {
        dropsEnrollment: selectedLines.some((l) => l.enrollmentId !== null),
        reversesDiscount:
          selectedLines.length === breakdown.lines.length, // only on full unwind
        revokesCertificate: true,
        cancelsFutureWebinarRegistrations: true,
      },
    };
  }

  /**
   * Eligible-for-refund payments for the admin Initiate Refund picker.
   * Status = paid, no in-flight refund already attached, ordered by
   * most recent paidAt.
   */
  async listRefundablePayments(search?: string, limit: number = 25) {
    const conditions: any[] = [eq(payments.status, PAYMENT_STATUS.PAID)];
    if (search) {
      const q = `%${search}%`;
      conditions.push(
        sql`(${users.email} ILIKE ${q}
             OR ${users.firstName} ILIKE ${q}
             OR ${users.lastName} ILIKE ${q}
             OR ${courses.title} ILIKE ${q}
             OR ${payments.gatewayChargeId} ILIKE ${q})`,
      );
    }

    const rows = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        gateway: payments.gateway,
        paidAt: payments.paidAt,
        userId: payments.userId,
        userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        userEmail: users.email,
        courseId: payments.courseId,
        courseTitle: courses.title,
      })
      .from(payments)
      .leftJoin(users, eq(payments.userId, users.id))
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .where(and(...conditions))
      .orderBy(desc(payments.paidAt))
      .limit(Math.min(limit, 50));

    // Filter out payments with an active refund already in flight
    const paymentIds = rows.map((r) => r.id);
    if (paymentIds.length === 0) return [];

    const blockedRows = await db
      .select({ paymentId: refunds.paymentId })
      .from(refunds)
      .where(
        and(
          inArray(refunds.paymentId, paymentIds),
          sql`${refunds.status} IN ('pending','approved','processing','completed')`,
        ),
      );
    const blocked = new Set(blockedRows.map((b) => b.paymentId));

    return rows.filter((r) => !blocked.has(r.id));
  }

  async exportRefundsCsv(
    status?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<string> {
    const conditions = this.buildRefundConditions(status, undefined, startDate, endDate);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.buildRefundBaseQuery()
      .where(whereClause)
      .orderBy(desc(refunds.createdAt));

    const metaRows: (string | number | null)[][] = [
      ['# PhysioGuidance Refund Export | NELC Compliant'],
      [`# Generated: ${new Date().toISOString()}`],
    ];
    if (startDate || endDate) {
      metaRows.push([`# Date Range: ${startDate || 'beginning'} to ${endDate || 'now'}`]);
    }
    if (status) metaRows.push([`# Status Filter: ${status}`]);
    metaRows.push(['']);

    const headerRow: (string | number | null)[] = [
      'RefundID', 'Requester', 'Email', 'Course', 'Reason',
      'OriginalAmount', 'DeductionAmount', 'RefundAmount', 'Gateway', 'Status',
      'RequestDate', 'ApprovedAt', 'CompletedAt',
    ];
    const dataRows: (string | number | null)[][] = rows.map((row) => [
      row.id,
      row.requesterName,
      row.requesterEmail,
      row.courseTitle,
      row.reason,
      row.originalAmount,
      row.deductionAmount,
      row.refundAmount,
      row.gateway,
      row.status,
      row.createdAt ? new Date(row.createdAt).toISOString() : '',
      row.approvedAt ? new Date(row.approvedAt).toISOString() : '',
      row.completedAt ? new Date(row.completedAt).toISOString() : '',
    ]);

    return toCsvString([...metaRows, headerRow, ...dataRows]);
  }
}

// ─── Pure helpers ──────────────────────────────────────────────────

/** 2dp rounding using bankers' floor — avoids the floating-point drift
 *  toFixed gives on values like 0.575 (→ 0.57 instead of 0.58). */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Accept number, numeric string, or undefined/null/non-number from a
 *  JSONB metadata blob and return a plain number (or undefined). */
function numFromMeta(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}
