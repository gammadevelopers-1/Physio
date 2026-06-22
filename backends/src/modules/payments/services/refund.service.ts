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
  payments,
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
import { GatewayFactory } from '../gateways/gateway.factory';
import { EmailService } from '../../email/email.service';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { RejectRefundDto } from '../dto/reject-refund.dto';
import { DiscountService } from './discount.service';
import { ZOOM_SERVICE, IZoomService } from '../../zoom/zoom.interface';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  /**
   * Merchant fee rates by gateway — this is the COST WE BEAR on a refund,
   * reconciled by Tamara/Tabby on our next settlement. It is NOT deducted
   * from the customer's refund. We record it on the refund row (in the
   * `deductionAmount` column, semantics now = "merchant fee borne") so
   * finance can reconcile against gateway settlement reports.
   *
   * Confirmed via:
   *   - Tamara docs: "the refunded amount will be deducted from your next
   *     settlement" (https://docs.tamara.co/docs/direct-online-checkout)
   *   - Tabby API: refund `amount` field = amount customer receives, fees
   *     reported in settlement payout report
   *   - Direct confirmation from Tamara support (relayed by Amna)
   *
   * Customers ALWAYS receive the full refund amount we send to the gateway.
   */
  private readonly merchantFeeRates: Record<string, number>;

  /**
   * Gateways that support a partial-amount refund (refund less than the
   * original payment). Per Amna's Q1 decision: enabled on Moyasar and
   * Bank Transfer only. BNPL gateways do not reliably handle partial
   * refunds without desyncing the installment schedule.
   */
  private readonly partialRefundCapable = new Set(['moyasar', 'bank_transfer', 'mock']);

  constructor(
    private readonly configService: ConfigService,
    private readonly gatewayFactory: GatewayFactory,
    private readonly auditLogService: AuditLogService,
    private readonly emailService: EmailService,
    private readonly discountService: DiscountService,
    @Inject(ZOOM_SERVICE) private readonly zoomService: IZoomService,
  ) {
    const tabbyRate =
      this.configService.get<number>('payments.tabbyRefundDeductionRate') ?? 0.1;
    this.merchantFeeRates = {
      moyasar: 0,
      tamara: 0.1,
      tabby: tabbyRate,
      bank_transfer: 0,
      mock: 0,
    };
  }

  /**
   * Compute the refund math for a given payment and requested refund
   * amount. Single source of truth for both `requestRefund` (student),
   * `adminInitiateRefund` (finance), and `getRefundPreview` (UI).
   *
   * Throws BadRequestException when the requested amount violates the
   * gateway's partial-refund capability.
   */
  private computeRefundMath(
    gateway: string,
    originalAmount: number,
    requestedAmount?: number,
  ): {
    refundAmount: number;
    merchantFeeAmount: number;
    merchantFeeReason: string | null;
    isPartial: boolean;
  } {
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

    const isPartial = requested < safeOriginal;
    if (isPartial && !this.partialRefundCapable.has(gateway)) {
      throw new BadRequestException(
        `Partial refunds are not supported for ${gateway}. Send the full amount or change gateway.`,
      );
    }

    const merchantFeeRate = this.merchantFeeRates[gateway] || 0;
    // Merchant fee is calculated on the REFUNDED amount, not the original
    // — Tamara/Tabby retain a proportional fee on what was refunded.
    const merchantFeeAmount = Number((requested * merchantFeeRate).toFixed(2));

    const gatewayLabels: Record<string, string> = {
      tamara: 'Tamara BNPL',
      tabby: 'Tabby BNPL',
    };
    const merchantFeeReason =
      merchantFeeAmount > 0
        ? `${gatewayLabels[gateway] || gateway} ${Math.round(merchantFeeRate * 100)}% merchant fee (reconciled on settlement, NOT deducted from customer)`
        : null;

    return {
      refundAmount: requested,
      merchantFeeAmount,
      merchantFeeReason,
      isPartial,
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

    // Block if ANY active or completed refund exists for this payment.
    // Multi-refund (e.g., a second partial after one completed) is not
    // supported in v1.
    const [existingRefund] = await db
      .select()
      .from(refunds)
      .where(
        and(
          eq(refunds.paymentId, dto.paymentId),
          sql`${refunds.status} IN ('pending', 'approved', 'processing', 'completed')`,
        ),
      )
      .limit(1);

    if (existingRefund) {
      throw new BadRequestException(
        'A refund already exists for this payment',
      );
    }

    // Student-initiated requests are always FULL refunds. Partial is an
    // admin-only action (see adminInitiateRefund).
    const originalAmount = Number(payment.amount);
    const { refundAmount, merchantFeeAmount, merchantFeeReason } =
      this.computeRefundMath(payment.gateway, originalAmount);

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
        isPartial: false,
      },
    });

    return refund;
  }

  async approveRefund(refundId: string, processedBy: string, ipAddress?: string, approvalNote?: string) {
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
          updatedAt: new Date(),
        })
        .where(eq(refunds.id, refundId));
    }

    // Step 2: Call gateway to initiate the actual refund transfer
    let gatewayRefundId: string | null = null;
    try {
      const gateway = this.gatewayFactory.getGateway(payment.gateway);
      const refundResult = await gateway.refund({
        gatewayChargeId: payment.gatewayChargeId,
        amount: Number(refund.refundAmount),
        reason: refund.reason,
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

      // For mock gateway, complete immediately (no async webhook)
      if (payment.gateway === 'mock') {
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
      },
    });

    return { status: 'approved', gatewayRefundId };
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
    const courseId = payment?.courseId;
    const studentId = payment?.userId;

    // Find future-dated WEBINAR sessions for this course (we only cancel
    // upcoming attendance — past sessions already happened). We also
    // pull the Zoom webinar ID so we can revoke at the Zoom layer after
    // the DB commit (defense-in-depth: even if a refunded learner has
    // their join URL cached, Zoom denies entry).
    const futureWebinarSessions =
      courseId && studentId
        ? await db
            .select({
              id: sessions.id,
              zoomWebinarId: sessions.zoomWebinarId,
            })
            .from(sessions)
            .where(
              and(
                eq(sessions.courseId, courseId),
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

      // Payment status: partial vs full. With BNPL deductions now removed,
      // PARTIALLY_REFUNDED only fires on a TRUE admin-set partial amount.
      const originalAmount = Number(refund.originalAmount);
      const refundAmount = Number(refund.refundAmount);
      const paymentStatus =
        refundAmount >= originalAmount
          ? PAYMENT_STATUS.REFUNDED
          : PAYMENT_STATUS.PARTIALLY_REFUNDED;

      await tx
        .update(payments)
        .set({
          status: paymentStatus,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, refund.paymentId));

      // Invoice status
      if (refund.invoiceId) {
        await tx
          .update(invoices)
          .set({
            status: INVOICE_STATUS.REFUNDED,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, refund.invoiceId));
      }

      // 1. Drop enrollment
      if (payment?.enrollmentId) {
        await tx
          .update(enrollments)
          .set({ status: ENROLLMENT_STATUS.DROPPED })
          .where(eq(enrollments.id, payment.enrollmentId));
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
      // IS the CME credential; there is no separate CME table)
      if (courseId && studentId) {
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
              eq(certificateRequests.courseId, courseId),
              eq(certificateRequests.studentId, studentId),
              sql`${certificateRequests.status} <> 'revoked'`,
            ),
          )
          .returning({ id: certificateRequests.id });
        cascade.certificateRevoked = revoked.length > 0;
      }
    });

    // Reverse discount usage so the coupon can be reused
    try {
      await this.discountService.reverseUsage(refund.paymentId);
    } catch (err) {
      this.logger.error(
        `Failed to reverse discount usage for payment ${refund.paymentId}: ${err.message}`,
      );
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
    courseTitle: sql<string>`${courses.title}`,
    courseTitleAr: sql<string>`${courses.titleAr}`,
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

    return {
      ...base,
      processorName,
      processorEmail,
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
      /** Optional partial refund amount. Defaults to full payment. Only
       * honored for Moyasar / Bank Transfer; BNPL forces full. */
      refundAmount?: number;
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
          sql`${refunds.status} IN ('pending', 'approved', 'processing', 'completed')`,
        ),
      )
      .limit(1);

    if (existingRefund) {
      throw new BadRequestException(
        'A refund already exists for this payment',
      );
    }

    const originalAmount = Number(payment.amount);
    const { refundAmount, merchantFeeAmount, merchantFeeReason, isPartial } =
      this.computeRefundMath(
        payment.gateway,
        originalAmount,
        dto.refundAmount,
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
      action: 'refund_admin_initiated',
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
  async getRefundPreview(paymentId: string, requestedAmount?: number) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PAYMENT_STATUS.PAID) {
      throw new BadRequestException(
        'Only paid payments are eligible for a refund preview',
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
          sql`${refunds.status} IN ('pending', 'approved', 'processing','completed')`,
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

    const originalAmount = Number(payment.amount);
    const { refundAmount, merchantFeeAmount, merchantFeeReason, isPartial } =
      this.computeRefundMath(
        payment.gateway,
        originalAmount,
        requestedAmount,
      );
    const merchantFeeRate = this.merchantFeeRates[payment.gateway] || 0;

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

    const supportsPartial = this.partialRefundCapable.has(payment.gateway);

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
      capabilities: {
        supportsPartial,
        maxRefundAmount: originalAmount,
        minRefundAmount: supportsPartial ? 1 : originalAmount,
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
        dropsEnrollment: !!payment.enrollmentId,
        reversesDiscount: true,
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

    const lines: string[] = [];

    // NELC metadata header
    lines.push('# PhysioGuidance Refund Export | NELC Compliant');
    lines.push(`# Generated: ${new Date().toISOString()}`);
    if (startDate || endDate) {
      lines.push(`# Date Range: ${startDate || 'beginning'} to ${endDate || 'now'}`);
    }
    if (status) {
      lines.push(`# Status Filter: ${status}`);
    }
    lines.push('');

    // CSV header
    lines.push(
      'RefundID,Requester,Email,Course,Reason,OriginalAmount,DeductionAmount,RefundAmount,Gateway,Status,RequestDate,ApprovedAt,CompletedAt',
    );

    const escapeCsv = (val: any) => {
      if (val == null) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    for (const row of rows) {
      lines.push(
        [
          escapeCsv(row.id),
          escapeCsv(row.requesterName),
          escapeCsv(row.requesterEmail),
          escapeCsv(row.courseTitle),
          escapeCsv(row.reason),
          escapeCsv(row.originalAmount),
          escapeCsv(row.deductionAmount),
          escapeCsv(row.refundAmount),
          escapeCsv(row.gateway),
          escapeCsv(row.status),
          escapeCsv(row.createdAt ? new Date(row.createdAt).toISOString() : ''),
          escapeCsv(row.approvedAt ? new Date(row.approvedAt).toISOString() : ''),
          escapeCsv(row.completedAt ? new Date(row.completedAt).toISOString() : ''),
        ].join(','),
      );
    }

    return lines.join('\n');
  }
}
