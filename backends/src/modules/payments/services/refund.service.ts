import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, desc, count, sql } from 'drizzle-orm';
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
} from '../../../database/schema';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { GatewayFactory } from '../gateways/gateway.factory';
import { EmailService } from '../../email/email.service';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { RejectRefundDto } from '../dto/reject-refund.dto';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  // Deduction rates by gateway
  private readonly deductionRates: Record<string, number> = {
    tap: 0,
    moyasar: 0,
    tamara: 0.1,
    tabby: 0.1,
    mock: 0,
  };

  constructor(
    private readonly gatewayFactory: GatewayFactory,
    private readonly auditLogService: AuditLogService,
    private readonly emailService: EmailService,
  ) {}

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

  async approveRefund(refundId: string, processedBy: string, ipAddress?: string) {
    const [refund] = await db
      .select()
      .from(refunds)
      .where(eq(refunds.id, refundId))
      .limit(1);

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    if (refund.status !== REFUND_STATUS.PENDING) {
      throw new BadRequestException('Only pending refunds can be approved');
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

    // Call gateway refund
    const gateway = this.gatewayFactory.getGateway(payment.gateway);
    const refundResult = await gateway.refund({
      gatewayChargeId: payment.gatewayChargeId,
      amount: Number(refund.refundAmount),
      reason: refund.reason,
    });

    // Update refund status
    await db
      .update(refunds)
      .set({
        status: REFUND_STATUS.PROCESSING,
        processedBy,
        gatewayRefundId: refundResult.refundId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(refunds.id, refundId));

    // For mock gateway, complete immediately
    if (payment.gateway === 'mock') {
      await this.completeRefund(refundId);
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
        gatewayRefundId: refundResult.refundId,
        refundAmount: refund.refundAmount,
      },
    });

    return { status: 'approved', gatewayRefundId: refundResult.refundId };
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

    if (refund.status !== REFUND_STATUS.PENDING) {
      throw new BadRequestException('Only pending refunds can be rejected');
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

      // Cancel enrollment
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, refund.paymentId))
        .limit(1);

      if (payment?.enrollmentId) {
        await tx
          .update(enrollments)
          .set({ status: 'dropped' })
          .where(eq(enrollments.id, payment.enrollmentId));
      }
    });

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

  async getAllRefunds(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const refundsList = await db
      .select({
        id: refunds.id,
        paymentId: refunds.paymentId,
        requesterName: sql<string>`CONCAT(requester.first_name, ' ', requester.last_name)`,
        requesterEmail: sql<string>`requester.email`,
        courseTitle: sql<string>`${courses.title}`,
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
      .leftJoin(
        sql`${users} AS requester`,
        eq(refunds.requestedBy, sql`requester.id`),
      )
      .leftJoin(payments, eq(refunds.paymentId, payments.id))
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .orderBy(desc(refunds.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(refunds);

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
}
