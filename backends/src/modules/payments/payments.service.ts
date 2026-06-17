import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, ne, desc, count, sql, inArray, or, ilike, gte, lte } from 'drizzle-orm';
import { db } from '../../database';
import {
  payments,
  courses,
  enrollments,
  users,
  invoices,
  PAYMENT_STATUS,
  COURSE_STATUS,
  ENROLLMENT_STATUS,
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { GatewayFactory } from './gateways/gateway.factory';
import { DiscountService } from './services/discount.service';
import { InvoiceService } from './services/invoice.service';
import { EmailService } from '../email/email.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { classifyCourse, getNelcMaxEnrollment } from '../courses/nelc-config';
import { getEffectivePrice } from '../courses/pricing.util';
import { PaymentGatewayError } from './gateways/payment-gateway.error';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly gatewayFactory: GatewayFactory,
    private readonly discountService: DiscountService,
    private readonly auditLogService: AuditLogService,
    private readonly invoiceService: InvoiceService,
    private readonly emailService: EmailService,
  ) {}

  async initiatePayment(user: AuthenticatedUser, dto: InitiatePaymentDto, ipAddress?: string) {
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

    // Course-level sale: charge the sale-adjusted price. A 100% sale makes the
    // effective price 0, which routes here to the free-enroll endpoint (same as
    // a genuinely free course).
    const sale = getEffectivePrice(course);
    const coursePrice = sale.effectivePrice;
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

    // 3. Validate discount code if provided (before transaction — read-only validation)
    // 4. NELC per-learner enrollment limit check
    const classification = classifyCourse(course.startDate, course.endDate);
    const nelcMaxPerLearner = getNelcMaxEnrollment(classification);

    const [learnerEnrollmentCount] = await db
      .select({ count: count() })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(
        and(
          eq(enrollments.studentId, user.id),
          inArray(enrollments.status, ['active', 'pending_payment']),
          classification === 'long'
            ? sql`(${courses.endDate}::date - ${courses.startDate}::date) > 5`
            : sql`(${courses.endDate}::date - ${courses.startDate}::date) <= 5 OR ${courses.startDate} IS NULL OR ${courses.endDate} IS NULL`,
        ),
      );

    if (Number(learnerEnrollmentCount?.count || 0) >= nelcMaxPerLearner) {
      throw new BadRequestException(
        `NELC limit reached: you may enroll in at most ${nelcMaxPerLearner} ${classification} courses`,
      );
    }

    let discountAmount = 0;
    let discountId: string | null = null;
    if (dto.discountCode) {
      // Sale + coupon are mutually exclusive unless the finance manager enabled
      // stacking for this course. When stacking IS allowed, the coupon applies
      // on top of the already-reduced sale price (coursePrice = sale price).
      if (sale.onSale && !sale.saleAllowsCoupon) {
        throw new BadRequestException(
          'This course is on sale; coupon codes cannot be combined with the sale.',
        );
      }
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

    // 5. Calculate totals (Saudi Arabia VAT = 15%)
    const subtotal = coursePrice;
    const VAT_RATE = 0.15;
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = Math.round(taxableAmount * VAT_RATE * 100) / 100;
    const totalAmount = Math.max(0, taxableAmount + taxAmount);

    if (totalAmount <= 0) {
      throw new BadRequestException(
        'Total amount is zero after discount. This course is effectively free.',
      );
    }

    // 6. Get the gateway adapter
    const gateway = this.gatewayFactory.getGateway(dto.gateway);

    // 7. Atomic transaction: create enrollment + payment (with FOR UPDATE lock)
    const result = await db.transaction(async (tx) => {
      // Lock existing enrollment row to prevent concurrent duplicates
      const existingRows = await tx.execute(
        sql`SELECT id, status FROM enrollments
            WHERE course_id = ${dto.courseId} AND student_id = ${user.id}
            FOR UPDATE LIMIT 1`,
      );
      const existing = existingRows.rows?.[0] as
        | { id: string; status: string }
        | undefined;

      if (existing) {
        if (existing.status === 'active') {
          throw new BadRequestException(
            'You are already enrolled in this course',
          );
        }
        if (existing.status === ENROLLMENT_STATUS.PENDING_PAYMENT) {
          // Cancel any stale pending payments so the user can start fresh
          await tx
            .update(payments)
            .set({
              status: PAYMENT_STATUS.FAILED,
              failedAt: new Date(),
              failureReason: 'Superseded by new payment attempt',
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(payments.enrollmentId, existing.id),
                eq(payments.status, PAYMENT_STATUS.PENDING),
              ),
            );
        }
      }

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
            originalPrice: sale.originalPrice,
            salePercent: sale.onSale ? sale.salePercent : null,
            saleDiscountAmount: sale.onSale
              ? Math.round((sale.originalPrice - sale.effectivePrice) * 100) / 100
              : 0,
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
    // Where the gateway's "Back"/cancel button should return the buyer: the
    // checkout page they came from (loads the course via ?courseId=), NOT the
    // post-payment callback page (which shows a "processing" spinner).
    const frontendBase =
      (callbackUrl || '').replace(/\/payment\/callback.*$/, '') ||
      'https://physioguidance.org';
    const cancelUrl = `${frontendBase}/${dto.locale || 'en'}/checkout?courseId=${dto.courseId}`;

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

    let chargeResult: Awaited<ReturnType<typeof gateway.createCharge>>;
    try {
      chargeResult = await gateway.createCharge({
        amount: totalAmount,
        currency: 'SAR',
        description: `Enrollment: ${course.title}`,
        customerName: `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim(),
        customerEmail: userData?.email || user.email,
        customerPhone: userData?.phone || undefined,
        redirectUrl: `${callbackUrl}?gateway=${dto.gateway}&payment_id=${result.payment.id}`,
        cancelUrl,
        webhookUrl: `${webhookBaseUrl}/${dto.gateway}`,
        metadata: {
          paymentId: result.payment.id,
          enrollmentId: result.enrollmentId,
          courseId: dto.courseId,
          userId: user.id,
        },
        locale: (dto.locale as 'ar' | 'en') || 'en',
        paymentMethod: dto.paymentMethod,
      });
    } catch (err) {
      if (err instanceof PaymentGatewayError) {
        this.logger.error(
          `Gateway error [${err.gateway}]: ${err.originalMessage} (${err.normalizedCode})`,
        );
        await this.processPaymentFailure(result.payment.id, err.originalMessage, err.normalizedCode);
        throw new BadRequestException(`Payment failed: ${err.originalMessage}`);
      }
      throw err;
    }

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
      ipAddress,
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

        // Generate invoice + send confirmation email (same path as real webhook processor)
        try {
          await this.invoiceService.generateInvoice(payment.id);
        } catch (err) {
          this.logger.error(`Invoice generation failed for mock payment ${payment.id}: ${err.message}`);
        }

        let pdfAttachment: { buffer: Buffer; filename: string } | undefined;
        try {
          const pdf = await this.invoiceService.getInvoicePdfBuffer(payment.id);
          if (pdf) pdfAttachment = pdf;
        } catch (_err) { /* non-fatal */ }

        try {
          await this.emailService.sendPaymentConfirmation(payment.userId, payment.id, pdfAttachment);
        } catch (err) {
          this.logger.error(`Confirmation email failed for mock payment ${payment.id}: ${err.message}`);
        }

        return { redirect: 'success', paymentId: payment_id };
      }

      if (status === 'failed') {
        const errorCode = query.error_code || 'unknown';
        await this.processPaymentFailure(
          payment.id,
          'Payment declined by gateway',
          errorCode,
        );
        return { redirect: 'failed', paymentId: payment_id };
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

    // Single-winner status flip: exactly one concurrent caller flips
    // pending -> paid, so duplicate webhooks can't double-process the order.
    let won = false;
    await db.transaction(async (tx) => {
      const flipped = await tx
        .update(payments)
        .set({
          status: PAYMENT_STATUS.PAID,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(payments.id, paymentId),
            ne(payments.status, PAYMENT_STATUS.PAID),
          ),
        )
        .returning({ id: payments.id });

      if (flipped.length === 0) return; // another caller already processed it
      won = true;

      // Activate enrollment (atomic with the status flip)
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

    if (!won) return; // lost the race — don't double-record usage / audit

    // Record discount usage if applicable. recordUsage is itself atomic +
    // idempotent; guard it so a usage hiccup can't abort an already-paid order.
    const metadata = payment.metadata as any;
    if (metadata?.discountId && metadata?.discountCode) {
      try {
        await this.discountService.recordUsage(
          metadata.discountId,
          payment.userId,
          payment.id,
          metadata.discountAmount || 0,
        );
      } catch (err) {
        this.logger.error(
          `Discount usage recording failed for payment ${paymentId}: ${(err as Error).message}`,
        );
      }
    }

    // Audit log
    await this.auditLogService.log({
      entityType: 'payment',
      entityId: paymentId,
      action: 'payment_completed',
      performedBy: payment.userId,
      ipAddress: 'system-webhook',
      metadata: {
        gateway: payment.gateway,
        amount: payment.amount,
        courseId: payment.courseId,
      },
    });
  }

  async processPaymentFailure(paymentId: string, reason?: string, errorCode?: string) {
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
          ...(errorCode ? { errorCode } : {}),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId));

      // Mark pending enrollment as dropped (preserves history for audit)
      if (payment.enrollmentId) {
        await tx
          .update(enrollments)
          .set({ status: ENROLLMENT_STATUS.DROPPED })
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
      ipAddress: 'system-webhook',
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

            // Generate invoice + send confirmation email (same as webhook path)
            try {
              await this.invoiceService.generateInvoice(paymentId);
            } catch (err) {
              this.logger.error(`Invoice generation failed for ${paymentId}: ${err.message}`);
            }
            try {
              let pdfAttachment: { buffer: Buffer; filename: string } | undefined;
              try {
                const pdf = await this.invoiceService.getInvoicePdfBuffer(paymentId);
                if (pdf) pdfAttachment = pdf;
              } catch {}
              await this.emailService.sendPaymentConfirmation(payment.userId, paymentId, pdfAttachment);
            } catch (err) {
              this.logger.error(`Payment confirmation email failed for ${paymentId}: ${err.message}`);
            }

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

  /**
   * Verify a payment when we only have the gateway's charge/invoice id rather
   * than our payment id — e.g. Moyasar redirects the buyer back with the Moyasar
   * invoice id (= our gatewayChargeId), not our payment_id. Resolves our payment
   * then reuses verifyPayment so completion/enrolment/email all run identically.
   */
  async verifyPaymentByCharge(chargeId: string, user: AuthenticatedUser) {
    const [payment] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.gatewayChargeId, chargeId),
          eq(payments.userId, user.id),
        ),
      )
      .limit(1);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.verifyPayment(payment.id, user);
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

  async getAllPayments(
    page: number = 1,
    limit: number = 10,
    status?: string,
    search?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const offset = (page - 1) * limit;
    const conditions: any[] = [];

    if (status && status !== 'all') {
      conditions.push(eq(payments.status, status as any));
    }
    if (search) {
      conditions.push(
        or(
          ilike(users.email, `%${search}%`),
          ilike(invoices.invoiceNumber, `%${search}%`),
          sql`CONCAT(${users.firstName}, ' ', ${users.lastName}) ILIKE ${'%' + search + '%'}`,
        ),
      );
    }
    if (startDate) {
      conditions.push(gte(payments.createdAt, new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(payments.createdAt, end));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
        errorCode: payments.errorCode,
        failureReason: payments.failureReason,
        gatewayChargeId: payments.gatewayChargeId,
        invoiceId: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        paidAt: payments.paidAt,
        failedAt: payments.failedAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .leftJoin(users, eq(payments.userId, users.id))
      .leftJoin(invoices, eq(invoices.paymentId, payments.id))
      .where(whereClause)
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(payments)
      .leftJoin(users, eq(payments.userId, users.id))
      .leftJoin(invoices, eq(invoices.paymentId, payments.id))
      .where(whereClause);

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
