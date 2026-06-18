import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, desc, count, sql, or, ilike, gte, lte } from 'drizzle-orm';
import { db } from '../../../database';
import {
  refunds,
  payments,
  invoices,
  enrollments,
  courses,
  users,
  PAYMENT_STATUS,
  REFUND_STATUS,
  ENROLLMENT_STATUS,
  INVOICE_STATUS,
} from '../../../database/schema';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { GatewayFactory } from '../gateways/gateway.factory';
import { EmailService } from '../../email/email.service';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { RejectRefundDto } from '../dto/reject-refund.dto';
import { DiscountService } from './discount.service';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  // Deduction rates by gateway — Tabby is configurable (per merchant agreement)
  private readonly deductionRates: Record<string, number>;

  constructor(
    private readonly configService: ConfigService,
    private readonly gatewayFactory: GatewayFactory,
    private readonly auditLogService: AuditLogService,
    private readonly emailService: EmailService,
    private readonly discountService: DiscountService,
  ) {
    const tabbyRate = this.configService.get<number>('payments.tabbyRefundDeductionRate') ?? 0.1;
    this.deductionRates = {
      moyasar: 0,
      tamara: 0.1,
      tabby: tabbyRate,
      bank_transfer: 0,
      mock: 0,
    };
  }

  async requestRefund(userId: string, dto: CreateRefundDto, ipAddress?: string) {
    // 1. Find the payment
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
      throw new BadRequestException(
        'Only paid payments can be refunded',
      );
    }

    // 2. Check for existing pending/processing refund
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
        'A refund request is already in progress for this payment',
      );
    }

    // 3. Calculate deduction
    const originalAmount = Number(payment.amount);
    const deductionRate = this.deductionRates[payment.gateway] || 0;
    const deductionAmount = originalAmount * deductionRate;
    const refundAmount = originalAmount - deductionAmount;

    // Build human-readable deduction reason for NELC audit trail
    const gatewayLabels: Record<string, string> = {
      tamara: 'Tamara BNPL',
      tabby: 'Tabby BNPL',
    };
    const deductionReason =
      deductionAmount > 0
        ? `${gatewayLabels[payment.gateway] || payment.gateway} ${Math.round(deductionRate * 100)}% processing fee`
        : null;

    // 4. Find associated invoice
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.paymentId, dto.paymentId))
      .limit(1);

    // 5. Create refund record
    const [refund] = await db
      .insert(refunds)
      .values({
        paymentId: dto.paymentId,
        invoiceId: invoice?.id || null,
        requestedBy: userId,
        reason: dto.reason,
        reasonNote: dto.reasonNote,
        originalAmount: originalAmount.toFixed(2),
        deductionAmount: deductionAmount.toFixed(2),
        deductionReason,
        refundAmount: refundAmount.toFixed(2),
        status: REFUND_STATUS.PENDING,
      })
      .returning();

    // 6. Send notification email
    try {
      await this.emailService.sendRefundRequested(userId, refund.id);
    } catch (err) {
      this.logger.error(`Failed to send refund requested email: ${err.message}`);
    }

    // 7. Audit log
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
        deductionAmount,
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

      // Update payment status
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

      // Update invoice status to refunded
      if (refund.invoiceId) {
        await tx
          .update(invoices)
          .set({
            status: INVOICE_STATUS.REFUNDED,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, refund.invoiceId));
      }

      // Drop enrollment so the learner loses course access
      if (payment?.enrollmentId) {
        await tx
          .update(enrollments)
          .set({ status: ENROLLMENT_STATUS.DROPPED })
          .where(eq(enrollments.id, payment.enrollmentId));
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
  ) {
    const conditions: any[] = [];
    if (status && status !== 'all') {
      conditions.push(eq(refunds.status, status));
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
  ) {
    const offset = (page - 1) * limit;
    const conditions = this.buildRefundConditions(status, search, startDate, endDate);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const refundsList = await this.buildRefundBaseQuery()
      .where(whereClause)
      .orderBy(desc(refunds.createdAt))
      .limit(limit)
      .offset(offset);

    // Count query — use status + date filters only (skip search for performance)
    const countConditions: any[] = [];
    if (status && status !== 'all') {
      countConditions.push(eq(refunds.status, status));
    }
    if (startDate) countConditions.push(gte(refunds.createdAt, new Date(startDate)));
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      countConditions.push(lte(refunds.createdAt, end));
    }
    const countWhere =
      countConditions.length > 0 ? and(...countConditions) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(refunds)
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
