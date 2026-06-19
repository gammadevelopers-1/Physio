import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, ne, desc, count, sql, inArray, or, ilike, gte, lte } from 'drizzle-orm';
import { db } from '../../database';
import {
  payments,
  paymentItems,
  paymentReceipts,
  courses,
  enrollments,
  users,
  invoices,
  PAYMENT_STATUS,
  COURSE_STATUS,
  ENROLLMENT_STATUS,
} from '../../database/schema';
import { isNull } from 'drizzle-orm';
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

  /**
   * Validate + price a cart without writing anything. Mirrors the read-only
   * pipeline in initiatePayment so the bank-transfer "draft" flow can show
   * accurate totals before any DB row exists. Throws the same exceptions
   * initiatePayment would have thrown so the FE error-handling is uniform.
   *
   * Skips the duplicate-in-flight-payment guard intentionally: the quote
   * itself isn't a commit, so it shouldn't block a buyer from previewing.
   * The actual submit (createBankTransferDraft) re-runs validation in the
   * same transaction that inserts the rows.
   */
  async quotePayment(
    user: AuthenticatedUser,
    dto: { courseIds: string[]; discountCode?: string },
  ) {
    const courseIds = Array.from(new Set(dto.courseIds));
    if (courseIds.length === 0) {
      throw new BadRequestException('At least one course is required');
    }

    const courseRows = await db
      .select()
      .from(courses)
      .where(
        and(
          inArray(courses.id, courseIds),
          eq(courses.status, COURSE_STATUS.ACTIVE),
        ),
      );
    if (courseRows.length !== courseIds.length) {
      const found = new Set(courseRows.map((c) => c.id));
      const missing = courseIds.filter((id) => !found.has(id));
      throw new NotFoundException(
        `Course(s) not available: ${missing.join(', ')}`,
      );
    }

    const courseById = new Map(courseRows.map((c) => [c.id, c]));
    const orderedCourses = courseIds.map((id) => courseById.get(id)!);

    const lines = orderedCourses.map((course) => {
      const sale = getEffectivePrice(course);
      const salePrice = sale.effectivePrice;
      if (salePrice <= 0) {
        throw new BadRequestException(
          `Course "${course.title}" is free — use the free-enroll flow instead.`,
        );
      }
      return { course, sale, salePrice };
    });

    for (const { course } of lines) {
      if (course.maxEnrollment) {
        const [countResult] = await db
          .select({ count: count() })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.courseId, course.id),
              eq(enrollments.status, 'active'),
            ),
          );
        if (Number(countResult?.count || 0) >= course.maxEnrollment) {
          throw new BadRequestException(`Course "${course.title}" is full`);
        }
      }
    }

    const cartByClassification = lines.reduce(
      (acc, { course }) => {
        const cls = classifyCourse(course.startDate, course.endDate);
        acc[cls] = (acc[cls] || 0) + 1;
        return acc;
      },
      {} as Record<'short' | 'long', number>,
    );

    for (const cls of ['short', 'long'] as const) {
      const cartCount = cartByClassification[cls] || 0;
      if (cartCount === 0) continue;
      const max = getNelcMaxEnrollment(cls);
      const [existing] = await db
        .select({ count: count() })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .where(
          and(
            eq(enrollments.studentId, user.id),
            inArray(enrollments.status, ['active', 'pending_payment']),
            cls === 'long'
              ? sql`(${courses.endDate}::date - ${courses.startDate}::date) > 5`
              : sql`(${courses.endDate}::date - ${courses.startDate}::date) <= 5 OR ${courses.startDate} IS NULL OR ${courses.endDate} IS NULL`,
          ),
        );
      const totalAfter = Number(existing?.count || 0) + cartCount;
      if (totalAfter > max) {
        throw new BadRequestException(
          `NELC limit reached: you may enroll in at most ${max} ${cls} courses. ` +
            `You currently have ${existing?.count || 0} and this order would add ${cartCount}.`,
        );
      }
    }

    const originalSubtotal =
      Math.round(lines.reduce((s, l) => s + Number(l.course.price), 0) * 100) /
      100;
    const subtotal =
      Math.round(lines.reduce((s, l) => s + l.salePrice, 0) * 100) / 100;
    const saleDiscount = Math.max(0, originalSubtotal - subtotal);

    let discountAmount = 0;
    let discountId: string | null = null;
    if (dto.discountCode) {
      const saleHoldout = lines.find(
        (l) => l.sale.onSale && !l.sale.saleAllowsCoupon,
      );
      if (saleHoldout) {
        throw new BadRequestException(
          `Course "${saleHoldout.course.title}" is on sale; coupon codes cannot be combined with the sale.`,
        );
      }
      const result = await this.discountService.validateDiscount(
        dto.discountCode,
        lines[0].course.id,
        user.id,
        subtotal,
      );
      if (!result.valid) {
        throw new BadRequestException(result.error || 'Invalid discount code');
      }
      discountAmount = result.discountAmount;
      discountId = result.discountId;
    }

    const VAT_RATE = 0.15;
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = Math.round(taxableAmount * VAT_RATE * 100) / 100;
    const totalAmount = Math.max(0, taxableAmount + taxAmount);

    if (totalAmount <= 0) {
      throw new BadRequestException(
        'Total amount is zero after discount. This order is effectively free.',
      );
    }

    return {
      courseIds,
      lineItems: lines.map(({ course, salePrice, sale }) => ({
        id: course.id,
        title: course.title,
        titleAr: course.titleAr,
        thumbnail: (course as any).thumbnail || null,
        price: Number(course.price),
        effectivePrice: salePrice,
        onSale: sale.onSale,
        salePercent: sale.salePercent,
        saleAllowsCoupon: sale.saleAllowsCoupon,
        deliveryType: course.deliveryType || null,
        startDate: course.startDate,
        cmeHours: course.cmeHours || 0,
      })),
      totals: {
        originalSubtotal,
        subtotal,
        saleDiscount,
        discountAmount,
        discountCode: dto.discountCode || null,
        discountId,
        taxAmount,
        totalAmount,
        currency: 'SAR',
      },
    };
  }

  async initiatePayment(user: AuthenticatedUser, dto: InitiatePaymentDto, ipAddress?: string) {
    // De-duplicate courseIds defensively — UI shouldn't send duplicates, but a
    // duplicate would crash the unique-per-payment constraint mid-transaction.
    const courseIds = Array.from(new Set(dto.courseIds));
    if (courseIds.length === 0) {
      throw new BadRequestException('At least one course is required');
    }

    // 1. Load all courses (active only) preserving cart order.
    const courseRows = await db
      .select()
      .from(courses)
      .where(
        and(
          inArray(courses.id, courseIds),
          eq(courses.status, COURSE_STATUS.ACTIVE),
        ),
      );

    if (courseRows.length !== courseIds.length) {
      const found = new Set(courseRows.map((c) => c.id));
      const missing = courseIds.filter((id) => !found.has(id));
      throw new NotFoundException(
        `Course(s) not available: ${missing.join(', ')}`,
      );
    }

    // Preserve cart order in the line items.
    const courseById = new Map(courseRows.map((c) => [c.id, c]));
    const orderedCourses = courseIds.map((id) => courseById.get(id)!);

    // Reject if the student already has an in-flight bank-transfer payment
    // for any course in this cart. Only AWAITING_APPROVAL blocks — that's
    // "finance is reviewing your receipt right now". Rejected attempts are
    // FAILED (not blocking) so the student is free to start over.
    const inFlightSingle = await db
      .select({ id: payments.id, courseId: payments.courseId })
      .from(payments)
      .where(
        and(
          eq(payments.userId, user.id),
          eq(payments.gateway, 'bank_transfer'),
          inArray(payments.status, [
            PAYMENT_STATUS.AWAITING_APPROVAL,
          ] as any),
          inArray(payments.courseId, courseIds),
        ),
      );
    const inFlightMulti = await db
      .select({ id: payments.id, courseId: paymentItems.courseId })
      .from(paymentItems)
      .innerJoin(payments, eq(payments.id, paymentItems.paymentId))
      .where(
        and(
          eq(payments.userId, user.id),
          eq(payments.gateway, 'bank_transfer'),
          inArray(payments.status, [
            PAYMENT_STATUS.AWAITING_APPROVAL,
          ] as any),
          inArray(paymentItems.courseId, courseIds),
        ),
      );
    const blocked = [...inFlightSingle, ...inFlightMulti].find((r) =>
      courseIds.includes(r.courseId),
    );
    if (blocked) {
      const c = courseById.get(blocked.courseId);
      throw new ConflictException(
        `You already have a bank transfer in review for "${c?.title || 'this course'}". Please wait for the finance team or replace the receipt from your pending payment page instead of starting a new payment.`,
      );
    }

    // 2. Per-course validation: must be paid, must not be at capacity.
    const lines = orderedCourses.map((course) => {
      const sale = getEffectivePrice(course);
      const salePrice = sale.effectivePrice;
      if (salePrice <= 0) {
        throw new BadRequestException(
          `Course "${course.title}" is free — use the free-enroll flow instead.`,
        );
      }
      return { course, sale, salePrice };
    });

    for (const { course } of lines) {
      if (course.maxEnrollment) {
        const [countResult] = await db
          .select({ count: count() })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.courseId, course.id),
              eq(enrollments.status, 'active'),
            ),
          );
        if (Number(countResult?.count || 0) >= course.maxEnrollment) {
          throw new BadRequestException(`Course "${course.title}" is full`);
        }
      }
    }

    // 3. NELC per-learner limit check — must factor in the COMPLETE cart.
    //    We sum the learner's existing enrollments by classification plus the
    //    cart-by-classification, then enforce per-class limits.
    const cartByClassification = lines.reduce(
      (acc, { course }) => {
        const cls = classifyCourse(course.startDate, course.endDate);
        acc[cls] = (acc[cls] || 0) + 1;
        return acc;
      },
      {} as Record<'short' | 'long', number>,
    );

    for (const cls of ['short', 'long'] as const) {
      const cartCount = cartByClassification[cls] || 0;
      if (cartCount === 0) continue;
      const max = getNelcMaxEnrollment(cls);

      const [existing] = await db
        .select({ count: count() })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .where(
          and(
            eq(enrollments.studentId, user.id),
            inArray(enrollments.status, ['active', 'pending_payment']),
            cls === 'long'
              ? sql`(${courses.endDate}::date - ${courses.startDate}::date) > 5`
              : sql`(${courses.endDate}::date - ${courses.startDate}::date) <= 5 OR ${courses.startDate} IS NULL OR ${courses.endDate} IS NULL`,
          ),
        );

      const totalAfter = Number(existing?.count || 0) + cartCount;
      if (totalAfter > max) {
        throw new BadRequestException(
          `NELC limit reached: you may enroll in at most ${max} ${cls} courses. ` +
            `You currently have ${existing?.count || 0} and this order would add ${cartCount}.`,
        );
      }
    }

    // 4. Compute the cart subtotal from the sale-adjusted prices.
    const subtotal =
      Math.round(lines.reduce((s, l) => s + l.salePrice, 0) * 100) / 100;

    // 5. Discount code — applied once, cart-wide, against the subtotal.
    //    For V1 a course-restricted discount uses the FIRST cart course as
    //    its qualifying line (the discount service is course-keyed).
    let discountAmount = 0;
    let discountId: string | null = null;
    if (dto.discountCode) {
      // Sale + coupon are mutually exclusive UNLESS every sale-on course in
      // the cart explicitly allows coupon stacking. One holdout disqualifies
      // the whole cart from coupon use — clearer than partial allocations.
      const saleHoldout = lines.find(
        (l) => l.sale.onSale && !l.sale.saleAllowsCoupon,
      );
      if (saleHoldout) {
        throw new BadRequestException(
          `Course "${saleHoldout.course.title}" is on sale; coupon codes cannot be combined with the sale.`,
        );
      }
      const discountResult = await this.discountService.validateDiscount(
        dto.discountCode,
        lines[0].course.id,
        user.id,
        subtotal,
      );
      if (!discountResult.valid) {
        throw new BadRequestException(
          discountResult.error || 'Invalid discount code',
        );
      }
      discountAmount = discountResult.discountAmount;
      discountId = discountResult.discountId;
    }

    // 6. Calculate totals (Saudi Arabia VAT = 15%)
    const VAT_RATE = 0.15;
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = Math.round(taxableAmount * VAT_RATE * 100) / 100;
    const totalAmount = Math.max(0, taxableAmount + taxAmount);

    if (totalAmount <= 0) {
      throw new BadRequestException(
        'Total amount is zero after discount. This order is effectively free.',
      );
    }

    // 7. Pre-compute line items for the insert (line discounts stay 0 — the
    //    cart-wide discount lives on the payment, NOT split across lines).
    const lineInserts = lines.map((l) => ({
      courseId: l.course.id,
      unitPrice: Number(l.course.price),
      salePrice: l.salePrice,
      lineDiscount: 0,
      lineTotal: l.salePrice,
    }));

    const gateway = this.gatewayFactory.getGateway(dto.gateway);

    // 8. Atomic transaction: per-course enrollment handling + payment + items.
    const result = await db.transaction(async (tx) => {
      const enrollmentIds: string[] = [];

      for (const { course } of lines) {
        const existingRows = await tx.execute(
          sql`SELECT id, status FROM enrollments
              WHERE course_id = ${course.id} AND student_id = ${user.id}
              FOR UPDATE LIMIT 1`,
        );
        const existing = existingRows.rows?.[0] as
          | { id: string; status: string }
          | undefined;

        if (existing && existing.status === 'active') {
          throw new BadRequestException(
            `You are already enrolled in "${course.title}"`,
          );
        }

        if (existing && existing.status === ENROLLMENT_STATUS.PENDING_PAYMENT) {
          // Cancel stale pending payments for THIS enrollment so the new
          // cart payment cleanly supersedes the abandoned attempt.
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
          // Also cancel stale pending cart-payments where this course was a line.
          await tx.execute(
            sql`UPDATE payments
                SET status = ${PAYMENT_STATUS.FAILED},
                    failed_at = NOW(),
                    failure_reason = 'Superseded by new payment attempt',
                    updated_at = NOW()
                WHERE status = ${PAYMENT_STATUS.PENDING}
                  AND id IN (
                    SELECT payment_id FROM payment_items
                    WHERE enrollment_id = ${existing.id}
                  )`,
          );
          enrollmentIds.push(existing.id);
          continue;
        }

        if (existing && existing.status === 'dropped') {
          await tx
            .update(enrollments)
            .set({ status: ENROLLMENT_STATUS.PENDING_PAYMENT })
            .where(eq(enrollments.id, existing.id));
          enrollmentIds.push(existing.id);
          continue;
        }

        // Brand-new enrollment.
        const [created] = await tx
          .insert(enrollments)
          .values({
            courseId: course.id,
            studentId: user.id,
            status: ENROLLMENT_STATUS.PENDING_PAYMENT,
          })
          .returning({ id: enrollments.id });
        enrollmentIds.push(created.id);
      }

      // 8a. Build per-line sale-discount snapshot for the payment metadata.
      const saleDiscountTotal =
        Math.round(
          lines.reduce(
            (s, l) =>
              s + (l.sale.onSale ? l.sale.originalPrice - l.sale.effectivePrice : 0),
            0,
          ) * 100,
        ) / 100;

      const originalSubtotal =
        Math.round(
          lines.reduce((s, l) => s + Number(l.course.price), 0) * 100,
        ) / 100;

      // 8b. Single payments row. For multi-line carts:
      //   - course_id = first cart course (preserves the legacy NOT NULL column
      //     and keeps single-course finance-dashboard joins working)
      //   - enrollment_id = NULL (line enrollments live in payment_items)
      // For genuine single-course carts (cart length 1), enrollment_id is set
      // so behavior matches the legacy single-course payment exactly.
      const primaryCourseId = lines[0].course.id;
      const primaryEnrollmentId = enrollmentIds[0];
      const isMultiLine = lines.length > 1;

      const [payment] = await tx
        .insert(payments)
        .values({
          enrollmentId: isMultiLine ? null : primaryEnrollmentId,
          userId: user.id,
          courseId: primaryCourseId,
          gateway: dto.gateway,
          paymentMethod: dto.paymentMethod,
          amount: totalAmount.toFixed(2),
          currency: 'SAR',
          status: PAYMENT_STATUS.PENDING,
          metadata: {
            subtotal,
            originalPrice: originalSubtotal,
            salePercent: null,
            saleDiscountAmount: saleDiscountTotal,
            discountAmount,
            discountId,
            discountCode: dto.discountCode || null,
            taxAmount,
            // Multi-course cart marker — downstream code (invoice generation,
            // refund splits, finance dashboards) checks this to know whether
            // to render line items or fall back to payments.course_id.
            isCart: isMultiLine,
            courseIds: lines.map((l) => l.course.id),
          },
        })
        .returning();

      // 8c. Insert one payment_items row per cart course.
      await tx.insert(paymentItems).values(
        lineInserts.map((li, idx) => ({
          paymentId: payment.id,
          courseId: li.courseId,
          enrollmentId: enrollmentIds[idx],
          unitPrice: li.unitPrice.toFixed(2),
          salePrice: li.salePrice.toFixed(2),
          discountAmount: li.lineDiscount.toFixed(2),
          lineTotal: li.lineTotal.toFixed(2),
        })),
      );

      return { payment, enrollmentIds };
    });

    // 9. Create charge via gateway
    const callbackUrl = this.configService.get<string>('payments.callbackUrl');
    const webhookBaseUrl = this.configService.get<string>(
      'payments.webhookBaseUrl',
    );
    // Where the gateway's "Back"/cancel button should return the buyer.
    // Multi-line cart → /checkout (reads from cart context); single course →
    // /checkout?courseId=… so the legacy express path still works.
    const frontendBase =
      (callbackUrl || '').replace(/\/payment\/callback.*$/, '') ||
      'https://physioguidance.org';
    const cancelUrl =
      lines.length === 1
        ? `${frontendBase}/${dto.locale || 'en'}/checkout?expressCourseId=${lines[0].course.id}`
        : `${frontendBase}/${dto.locale || 'en'}/checkout`;

    const [userData] = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    // Gateway description: single course → its title; multi → "N courses
    // (first title +N more)" so the buyer sees something recognisable on the
    // gateway page.
    const description =
      lines.length === 1
        ? `Enrollment: ${lines[0].course.title}`
        : `${lines.length} courses: ${lines[0].course.title}` +
          (lines.length > 1 ? ` (+${lines.length - 1} more)` : '');

    // Tabby's Pre-Scoring step requires a phone number on the buyer; without
    // one their checkout silently auto-declines. Surface a clear error up
    // front instead of letting the buyer fail at the gateway page.
    if (dto.gateway === 'tabby' && !userData?.phone) {
      throw new BadRequestException(
        'Tabby requires a phone number on your profile. Please add one in account settings, or use a different payment method.',
      );
    }

    let chargeResult: Awaited<ReturnType<typeof gateway.createCharge>>;
    try {
      chargeResult = await gateway.createCharge({
        amount: totalAmount,
        currency: 'SAR',
        description,
        customerName: `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim(),
        customerEmail: userData?.email || user.email,
        customerPhone: userData?.phone || undefined,
        customerRegisteredSince: userData?.createdAt
          ? new Date(userData.createdAt).toISOString()
          : undefined,
        redirectUrl: `${callbackUrl}?gateway=${dto.gateway}&payment_id=${result.payment.id}`,
        cancelUrl,
        webhookUrl: `${webhookBaseUrl}/${dto.gateway}`,
        metadata: {
          paymentId: result.payment.id,
          enrollmentId: result.enrollmentIds[0],
          courseId: lines[0].course.id,
          courseIds: lines.map((l) => l.course.id),
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
        await this.processPaymentFailure(
          result.payment.id,
          err.originalMessage,
          err.normalizedCode,
        );
        throw new BadRequestException(`Payment failed: ${err.originalMessage}`);
      }
      throw err;
    }

    // 10. Store gateway charge ID
    await db
      .update(payments)
      .set({
        gatewayChargeId: chargeResult.chargeId,
        gatewayResponse: chargeResult.rawResponse || null,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, result.payment.id));

    // 11. Audit log
    await this.auditLogService.log({
      entityType: 'payment',
      entityId: result.payment.id,
      action: 'payment_initiated',
      performedBy: user.id,
      ipAddress,
      metadata: {
        courseIds: lines.map((l) => l.course.id),
        gateway: dto.gateway,
        amount: totalAmount,
        chargeId: chargeResult.chargeId,
        itemCount: lines.length,
      },
    });

    this.logger.log(
      `Payment initiated: ${result.payment.id} for ${lines.length} course(s) via ${dto.gateway}`,
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

      // Activate enrollments atomically with the status flip.
      //
      // Multi-line payments: read all line enrollments from payment_items.
      // Legacy single-line payments: fall back to payments.enrollmentId.
      const lineEnrollmentRows = await tx
        .select({ enrollmentId: paymentItems.enrollmentId })
        .from(paymentItems)
        .where(eq(paymentItems.paymentId, paymentId));

      const enrollmentIdsToActivate = lineEnrollmentRows
        .map((r) => r.enrollmentId)
        .filter((id): id is string => Boolean(id));

      // Backwards-compat: pre-multi-line payments stored the enrollment id
      // directly on the payment row.
      if (enrollmentIdsToActivate.length === 0 && payment.enrollmentId) {
        enrollmentIdsToActivate.push(payment.enrollmentId);
      }

      if (enrollmentIdsToActivate.length > 0) {
        await tx
          .update(enrollments)
          .set({
            status: 'active',
            enrolledAt: new Date(),
          })
          .where(inArray(enrollments.id, enrollmentIdsToActivate));
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
    const cartCourseIds = (payment.metadata as any)?.courseIds as string[] | undefined;
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
        courseIds: cartCourseIds || [payment.courseId],
        itemCount: cartCourseIds?.length || 1,
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

      // Mark pending enrollments as dropped (preserves history for audit).
      // Multi-line: collect from payment_items; legacy: fall back to payment row.
      const lineEnrollmentRows = await tx
        .select({ enrollmentId: paymentItems.enrollmentId })
        .from(paymentItems)
        .where(eq(paymentItems.paymentId, paymentId));

      const enrollmentIdsToDrop = lineEnrollmentRows
        .map((r) => r.enrollmentId)
        .filter((id): id is string => Boolean(id));

      if (enrollmentIdsToDrop.length === 0 && payment.enrollmentId) {
        enrollmentIdsToDrop.push(payment.enrollmentId);
      }

      if (enrollmentIdsToDrop.length > 0) {
        await tx
          .update(enrollments)
          .set({ status: ENROLLMENT_STATUS.DROPPED })
          .where(
            and(
              inArray(enrollments.id, enrollmentIdsToDrop),
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
          // Use the gateway's normalized status mapping rather than raw
          // status strings — different providers return wildly different
          // shapes (Moyasar: 'paid', Tabby: 'CAPTURED', Tamara:
          // 'fully_captured'), and the previous string check only matched
          // Moyasar/Tabby — Tamara polls never converted to success.
          const normalized = await gateway.getPaymentStatus(payment.gatewayChargeId);

          if (normalized === 'paid') {
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
        // Active bank-transfer receipt (NULL for non-bank-transfer rows).
        // Surfaced so the Payments page detail can show refund info and the
        // upload timestamp ("time we received the receipt") without a second
        // round-trip.
        receiptUploadedAt: paymentReceipts.createdAt,
        receiptReviewStatus: paymentReceipts.reviewStatus,
        receiptReviewedAt: paymentReceipts.reviewedAt,
        receiptReviewerNote: paymentReceipts.reviewerNote,
        refundAccountHolder: paymentReceipts.refundAccountHolder,
        refundIban: paymentReceipts.refundIban,
        refundBankName: paymentReceipts.refundBankName,
        refundNationalId: paymentReceipts.refundNationalId,
      })
      .from(payments)
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .leftJoin(users, eq(payments.userId, users.id))
      .leftJoin(invoices, eq(invoices.paymentId, payments.id))
      .leftJoin(
        paymentReceipts,
        and(
          eq(paymentReceipts.paymentId, payments.id),
          isNull(paymentReceipts.replacedById),
        ),
      )
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
