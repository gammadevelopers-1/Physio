import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  payments,
  courses,
  enrollments,
  users,
  PAYMENT_STATUS,
  COURSE_STATUS,
  ENROLLMENT_STATUS,
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { GatewayFactory } from './gateways/gateway.factory';
import { DiscountService } from './services/discount.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly gatewayFactory: GatewayFactory,
    private readonly discountService: DiscountService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async initiatePayment(user: AuthenticatedUser, dto: InitiatePaymentDto) {
    // 1. Validate course exists, is active, and has a price
    const [course] = await db
      .select()
      .from(courses)
      .where(
        and(
          eq(courses.id, dto.courseId),
          eq(courses.status, COURSE_STATUS.ACTIVE),
        ),
      )
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found or not available');
    }

    const coursePrice = Number(course.price || 0);
    if (coursePrice <= 0) {
      throw new BadRequestException(
        'This course is free. Use the enroll endpoint instead.',
      );
    }

    // 2. Check max enrollment
    if (course.maxEnrollment) {
      const [countResult] = await db
        .select({ count: count() })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, dto.courseId),
            eq(enrollments.status, 'active'),
          ),
        );
      const currentCount = Number(countResult?.count || 0);
      if (currentCount >= course.maxEnrollment) {
        throw new BadRequestException('This course is full');
      }
    }

    // 3. Check for existing active or pending enrollment
    const [existing] = await db
      .select({ id: enrollments.id, status: enrollments.status })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, dto.courseId),
          eq(enrollments.studentId, user.id),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.status === 'active') {
        throw new BadRequestException(
          'You are already enrolled in this course',
        );
      }
      if (existing.status === ENROLLMENT_STATUS.PENDING_PAYMENT) {
        // Check if there's a pending payment for this enrollment
        const [pendingPayment] = await db
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.enrollmentId, existing.id),
              eq(payments.status, PAYMENT_STATUS.PENDING),
            ),
          )
          .limit(1);

        if (pendingPayment) {
          throw new BadRequestException(
            'You already have a pending payment for this course. Please complete or cancel it first.',
          );
        }
      }
    }

    // 4. Validate discount code if provided
    let discountAmount = 0;
    let discountId: string | null = null;
    if (dto.discountCode) {
      const discountResult = await this.discountService.validateDiscount(
        dto.discountCode,
        dto.courseId,
        user.id,
        coursePrice,
      );
      if (!discountResult.valid) {
        throw new BadRequestException(
          discountResult.error || 'Invalid discount code',
        );
      }
      discountAmount = discountResult.discountAmount;
      discountId = discountResult.discountId;
    }

    // 5. Calculate totals
    const subtotal = coursePrice;
    const taxAmount = 0; // VAT can be added later
    const totalAmount = Math.max(0, subtotal - discountAmount + taxAmount);

    if (totalAmount <= 0) {
      throw new BadRequestException(
        'Total amount is zero after discount. This course is effectively free.',
      );
    }

    // 6. Get the gateway adapter
    const gateway = this.gatewayFactory.getGateway(dto.gateway);

    // 7. Atomic transaction: create enrollment + payment
    const result = await db.transaction(async (tx) => {
      // Create or reuse enrollment
      let enrollmentId: string;

      if (existing && existing.status === ENROLLMENT_STATUS.PENDING_PAYMENT) {
        enrollmentId = existing.id;
      } else if (existing && existing.status === 'dropped') {
        // Reactivate dropped enrollment as pending_payment
        await tx
          .update(enrollments)
          .set({ status: ENROLLMENT_STATUS.PENDING_PAYMENT })
          .where(eq(enrollments.id, existing.id));
        enrollmentId = existing.id;
      } else {
        // Create new enrollment with pending_payment status
        const [newEnrollment] = await tx
          .insert(enrollments)
          .values({
            courseId: dto.courseId,
            studentId: user.id,
            status: ENROLLMENT_STATUS.PENDING_PAYMENT,
          })
          .returning({ id: enrollments.id });
        enrollmentId = newEnrollment.id;
      }

      // Create payment record
      const [payment] = await tx
        .insert(payments)
        .values({
          enrollmentId,
          userId: user.id,
          courseId: dto.courseId,
          gateway: dto.gateway,
          paymentMethod: dto.paymentMethod,
          amount: totalAmount.toFixed(2),
          currency: 'SAR',
          status: PAYMENT_STATUS.PENDING,
          metadata: {
            subtotal,
            discountAmount,
            discountId,
            discountCode: dto.discountCode || null,
            taxAmount,
          },
        })
        .returning();

      return { enrollmentId, payment };
    });

    // 8. Create charge via gateway
    const callbackUrl = this.configService.get<string>(
      'payments.callbackUrl',
    );
    const webhookBaseUrl = this.configService.get<string>(
      'payments.webhookBaseUrl',
    );

    const [userData] = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const chargeResult = await gateway.createCharge({
      amount: totalAmount,
      currency: 'SAR',
      description: `Enrollment: ${course.title}`,
      customerName: `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim(),
      customerEmail: userData?.email || user.email,
      customerPhone: userData?.phone || undefined,
      redirectUrl: `${callbackUrl}?gateway=${dto.gateway}&payment_id=${result.payment.id}`,
      webhookUrl: `${webhookBaseUrl}/${dto.gateway}`,
      metadata: {
        paymentId: result.payment.id,
        enrollmentId: result.enrollmentId,
        courseId: dto.courseId,
        userId: user.id,
      },
      locale: (dto.locale as 'ar' | 'en') || 'en',
    });

    // 9. Store gateway charge ID
    await db
      .update(payments)
      .set({
        gatewayChargeId: chargeResult.chargeId,
        gatewayResponse: chargeResult.rawResponse || null,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, result.payment.id));

    // 10. Audit log
    await this.auditLogService.log({
      entityType: 'payment',
      entityId: result.payment.id,
      action: 'payment_initiated',
      performedBy: user.id,
      metadata: {
        courseId: dto.courseId,
        gateway: dto.gateway,
        amount: totalAmount,
        chargeId: chargeResult.chargeId,
      },
    });

    this.logger.log(
      `Payment initiated: ${result.payment.id} for course ${dto.courseId} via ${dto.gateway}`,
    );

    return {
      paymentId: result.payment.id,
      redirectUrl: chargeResult.redirectUrl,
      amount: totalAmount,
      currency: 'SAR',
    };
  }

  async handleCallback(query: Record<string, string>) {
    const { gateway: gatewayName, payment_id, charge_id, status } = query;

    // For mock gateway, the callback carries the status directly
    if (gatewayName === 'mock' && payment_id) {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, payment_id))
        .limit(1);

      if (!payment) {
        return { redirect: 'failed', paymentId: payment_id };
      }

      // If webhook already processed it
      if (payment.status === PAYMENT_STATUS.PAID) {
        return { redirect: 'success', paymentId: payment_id };
      }
      if (payment.status === PAYMENT_STATUS.FAILED) {
        return { redirect: 'failed', paymentId: payment_id };
      }

      // For mock, directly process the payment (simulating webhook)
      if (status === 'paid') {
        await this.processPaymentSuccess(payment.id);
        return { redirect: 'success', paymentId: payment_id };
      }

      return { redirect: 'processing', paymentId: payment_id };
    }

    // For real gateways, redirect to processing page (webhook will handle async)
    if (payment_id) {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, payment_id))
        .limit(1);

      if (!payment) {
        return { redirect: 'failed', paymentId: payment_id };
      }

      if (payment.status === PAYMENT_STATUS.PAID) {
        return { redirect: 'success', paymentId: payment_id };
      }
      if (payment.status === PAYMENT_STATUS.FAILED) {
        return { redirect: 'failed', paymentId: payment_id };
      }

      return { redirect: 'processing', paymentId: payment_id };
    }

    return { redirect: 'failed', paymentId: null };
  }

  async processPaymentSuccess(paymentId: string) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment || payment.status === PAYMENT_STATUS.PAID) {
      return; // Already processed or doesn't exist
    }

    await db.transaction(async (tx) => {
      // Update payment status
      await tx
        .update(payments)
        .set({
          status: PAYMENT_STATUS.PAID,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId));

      // Activate enrollment
      if (payment.enrollmentId) {
        await tx
          .update(enrollments)
          .set({
            status: 'active',
            enrolledAt: new Date(),
          })
          .where(eq(enrollments.id, payment.enrollmentId));
      }
    });

    // Record discount usage if applicable
    const metadata = payment.metadata as any;
    if (metadata?.discountId && metadata?.discountCode) {
      await this.discountService.recordUsage(
        metadata.discountId,
        payment.userId,
        payment.id,
        metadata.discountAmount || 0,
      );
    }

    // Audit log
    await this.auditLogService.log({
      entityType: 'payment',
      entityId: paymentId,
      action: 'payment_completed',
      performedBy: payment.userId,
      metadata: {
        gateway: payment.gateway,
        amount: payment.amount,
        courseId: payment.courseId,
      },
    });
  }

  async processPaymentFailure(paymentId: string, reason?: string) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (
      !payment ||
      payment.status === PAYMENT_STATUS.PAID ||
      payment.status === PAYMENT_STATUS.FAILED
    ) {
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          status: PAYMENT_STATUS.FAILED,
          failedAt: new Date(),
          failureReason: reason || 'Payment failed',
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId));

      // Remove pending enrollment
      if (payment.enrollmentId) {
        await tx
          .delete(enrollments)
          .where(
            and(
              eq(enrollments.id, payment.enrollmentId),
              eq(enrollments.status, ENROLLMENT_STATUS.PENDING_PAYMENT),
            ),
          );
      }
    });

    await this.auditLogService.log({
      entityType: 'payment',
      entityId: paymentId,
      action: 'payment_failed',
      performedBy: payment.userId,
      metadata: { gateway: payment.gateway, reason },
    });
  }

  async verifyPayment(paymentId: string, user: AuthenticatedUser) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(eq(payments.id, paymentId), eq(payments.userId, user.id)),
      )
      .limit(1);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // If still pending, try polling the gateway
    if (
      payment.status === PAYMENT_STATUS.PENDING ||
      payment.status === PAYMENT_STATUS.PROCESSING
    ) {
      if (payment.gatewayChargeId) {
        try {
          const gateway = this.gatewayFactory.getGateway(payment.gateway);
          const charge = await gateway.getCharge(payment.gatewayChargeId);

          if (charge?.status === 'paid' || charge?.status === 'CAPTURED') {
            await this.processPaymentSuccess(paymentId);
            return { status: PAYMENT_STATUS.PAID, paymentId };
          }
        } catch (err) {
          this.logger.warn(
            `Failed to poll gateway for payment ${paymentId}: ${err.message}`,
          );
        }
      }
    }

    return {
      status: payment.status,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      gateway: payment.gateway,
      paidAt: payment.paidAt,
    };
  }

  async getMyPayments(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const offset = (page - 1) * limit;

    const paymentsList = await db
      .select({
        id: payments.id,
        courseId: payments.courseId,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        gateway: payments.gateway,
        paymentMethod: payments.paymentMethod,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(payments)
      .where(eq(payments.userId, userId));

    return {
      data: paymentsList,
      pagination: {
        page,
        limit,
        total: Number(totalResult?.count || 0),
        totalPages: Math.ceil(Number(totalResult?.count || 0) / limit),
      },
    };
  }

  async getPaymentById(paymentId: string) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    return payment || null;
  }

  async getPaymentByChargeId(gatewayChargeId: string) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.gatewayChargeId, gatewayChargeId))
      .limit(1);

    return payment || null;
  }

  async getAllPayments(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

    const paymentsList = await db
      .select({
        id: payments.id,
        userId: payments.userId,
        userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        userEmail: users.email,
        courseId: payments.courseId,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        gateway: payments.gateway,
        paymentMethod: payments.paymentMethod,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        paidAt: payments.paidAt,
        failedAt: payments.failedAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .leftJoin(users, eq(payments.userId, users.id))
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(payments);

    return {
      data: paymentsList,
      pagination: {
        page,
        limit,
        total: Number(totalResult?.count || 0),
        totalPages: Math.ceil(Number(totalResult?.count || 0) / limit),
      },
    };
  }
}
