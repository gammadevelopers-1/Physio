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
  refunds,
  reconciliationFindings,
  reconciliationEscalations,
  auditLogs,
  PAYMENT_STATUS,
  COURSE_STATUS,
  ENROLLMENT_STATUS,
} from '../../database/schema';
import { isNull } from 'drizzle-orm';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { GatewayFactory } from './gateways/gateway.factory';
import { TabbyGateway } from './gateways/tabby.gateway';
import { DiscountService } from './services/discount.service';
import { InvoiceService } from './services/invoice.service';
import { TaxComputationService } from './services/tax-computation.service';
import { EmailService } from '../email/email.service';
import { StorageService } from '../storage/storage.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { classifyCourse, getNelcMaxEnrollment } from '../courses/nelc-config';
import { getEffectivePrice } from '../courses/pricing.util';
import { PaymentGatewayError } from './gateways/payment-gateway.error';
import { TamaraGateway } from './gateways/tamara.gateway';
import { decryptPII } from '../../common/crypto';
import { XapiService } from '../xapi/xapi.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';

/**
 * Validate and normalize a Saudi phone number to E.164 format (+9665XXXXXXXX).
 *
 * Saudi mobile numbers are exactly 9 digits after the country code and always
 * start with 5. We accept the four common input shapes:
 *   05XXXXXXXX, 5XXXXXXXX, +9665XXXXXXXX, 9665XXXXXXXX
 *
 * Returns `null` when the input doesn't conform (e.g. Pakistan numbers like
 * 03045570099) so callers can throw a clean user-facing error rather than
 * forwarding garbage to the BNPL gateway. The gateways themselves return
 * PII-tokenized "Invalid v1:...==" messages that are useless in the UI.
 */
function normalizeSaudiPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (/^9665\d{8}$/.test(digits)) return `+${digits}`;
  if (/^05\d{8}$/.test(digits)) return `+966${digits.slice(1)}`;
  if (/^5\d{8}$/.test(digits)) return `+966${digits}`;
  return null;
}

/**
 * BNPL gateways (Tamara especially) redact PII fields in their error responses
 * with format-preserving tokens like `v1:89IdJtlO7yceugQS:lV+...==`. Surfaced
 * verbatim, these read as gibberish ("Payment failed: Invalid v1:...= number
 * v1:...=") and give the buyer no actionable signal. Strip the tokens and, if
 * the remaining text mentions phone / address / consumer, fall back to a
 * targeted, human-readable message.
 */
function sanitizeGatewayErrorMessage(raw: string, gateway: string): string {
  if (!raw) return 'The payment provider rejected the request.';
  const tokenized = /v1:[A-Za-z0-9+/=:]{20,}/.test(raw);
  const stripped = raw.replace(/v1:[A-Za-z0-9+/=:]{20,}/g, '').replace(/\s+/g, ' ').trim();
  const lower = stripped.toLowerCase();
  if (tokenized && /phone|number/.test(lower)) {
    return `${gateway === 'tamara' ? 'Tamara' : gateway === 'tabby' ? 'Tabby' : 'The provider'} rejected the phone number on your profile. Please update it to a Saudi mobile (05XXXXXXXX or +9665XXXXXXXX) and try again.`;
  }
  if (tokenized && /address|city|country/.test(lower)) {
    return `${gateway === 'tamara' ? 'Tamara' : 'The provider'} rejected the shipping address on this order. Please contact support.`;
  }
  if (tokenized) {
    return `${gateway === 'tamara' ? 'Tamara' : 'The payment provider'} rejected the request. Please verify your profile details (phone, address) or try a different payment method.`;
  }
  return stripped || 'The payment provider rejected the request.';
}

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
    private readonly storageService: StorageService,
    private readonly taxComputationService: TaxComputationService,
    private readonly xapiService: XapiService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  /**
   * Build the buyer-history snapshot BNPL gateways consume for underwriting.
   *
   * Tabby's docs (https://docs.tabby.ai/api-reference/checkout/create-a-session)
   * call out two specific signals that materially affect approval rates:
   *   - loyalty_level — total successful purchases (any gateway, any time).
   *     We used to hardcode 0, which made every returning buyer look brand-new.
   *   - order_history — up to 10 most-recent past orders excluding the current
   *     row, with payment status, amount, and item context.
   *
   * Both are read with a single round-trip via a windowed query. Statuses are
   * mapped from our internal vocab into Tabby's vocab here so the gateway
   * layer stays a thin formatter.
   */
  private async buildBuyerHistory(
    userId: string,
    currentPaymentId: string,
  ): Promise<{
    loyaltyLevel: number;
    pastOrders: Array<{
      purchasedAt: string;
      amount: string;
      status:
        | 'new'
        | 'processing'
        | 'complete'
        | 'refunded'
        | 'canceled'
        | 'unknown';
      itemTitle: string;
    }>;
  }> {
    // Pull last 10 orders + per-user successful purchase count in a single
    // query each. Excluding the current payment from order_history is
    // explicit in Tabby's spec.
    const [pastRows, [loyaltyRow]] = await Promise.all([
      db
        .select({
          id: payments.id,
          amount: payments.amount,
          status: payments.status,
          paidAt: payments.paidAt,
          createdAt: payments.createdAt,
          courseTitle: courses.title,
        })
        .from(payments)
        .leftJoin(courses, eq(courses.id, payments.courseId))
        .where(
          and(eq(payments.userId, userId), ne(payments.id, currentPaymentId)),
        )
        .orderBy(desc(payments.createdAt))
        .limit(10),
      db
        .select({ count: count() })
        .from(payments)
        .where(
          and(
            eq(payments.userId, userId),
            eq(payments.status, PAYMENT_STATUS.PAID),
          ),
        ),
    ]);

    const mapStatus = (
      raw: string,
    ):
      | 'new'
      | 'processing'
      | 'complete'
      | 'refunded'
      | 'canceled'
      | 'unknown' => {
      switch (raw) {
        case PAYMENT_STATUS.PAID:
          return 'complete';
        case PAYMENT_STATUS.PENDING:
        case PAYMENT_STATUS.PROCESSING:
        case PAYMENT_STATUS.AWAITING_APPROVAL:
          return 'processing';
        case PAYMENT_STATUS.REFUNDED:
        case PAYMENT_STATUS.PARTIALLY_REFUNDED:
        case PAYMENT_STATUS.CHARGEBACK:
          return 'refunded';
        case PAYMENT_STATUS.FAILED:
        case 'abandoned':
        case 'rejected':
          return 'canceled';
        default:
          return 'unknown';
      }
    };

    return {
      loyaltyLevel: Number(loyaltyRow?.count || 0),
      pastOrders: pastRows.map((r) => ({
        purchasedAt: new Date(r.paidAt || r.createdAt).toISOString(),
        amount: Number(r.amount).toFixed(2),
        status: mapStatus(r.status),
        itemTitle: r.courseTitle || 'Course',
      })),
    };
  }

  /**
   * Background pre-scoring for Tabby — call when the checkout page mounts
   * so we can hide the Tabby radio if underwriting will reject this buyer
   * for this cart amount. Per Tabby docs:
   *   https://docs.tabby.ai/pay-in-4-custom-integration/checkout-flow#background-pre-scoring-check
   *
   * Re-uses quotePayment to compute the cart total + sanity-check the cart,
   * builds the same buyer-history + attachment payload createCharge would
   * send (so the verdict matches what the real Pay-Now session would
   * receive), then delegates to TabbyGateway.prescore. Does NOT create any
   * DB rows — Tabby's session is throwaway.
   *
   * Fails open: any unexpected error returns eligible=true so the radio
   * stays visible and the buyer can still attempt payment.
   */
  async prescoreTabby(
    user: AuthenticatedUser,
    dto: { courseIds: string[]; discountCode?: string; locale?: 'ar' | 'en' },
  ): Promise<{ eligible: boolean; reason?: string; message?: string }> {
    try {
      const quote = await this.quotePayment(user, {
        courseIds: dto.courseIds,
        discountCode: dto.discountCode,
      });

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

      const plaintextPhone = decryptPII(userData?.phone);
      // Tabby requires a Saudi phone for pre-scoring too. If the buyer
      // doesn't have one on file, mark them ineligible up-front (same as
      // the real Pay-Now check would do) so the radio hides cleanly.
      if (!plaintextPhone) {
        this.logger.log(
          `Tabby prescore short-circuit: user ${user.id} has no phone on profile`,
        );
        return {
          eligible: false,
          reason: 'phone_required',
          message:
            'Tabby requires a Saudi phone number on your profile. Please add one in account settings.',
        };
      }

      const buyerHistory = await this.buildBuyerHistory(
        user.id,
        // No real paymentId yet — pass a sentinel so the exclusion clause
        // in buildBuyerHistory doesn't accidentally match a real row.
        '00000000-0000-0000-0000-000000000000',
      );

      // Primary course for the attachment program-length calc — mirrors
      // initiatePayment's logic.
      const [primaryCourse] = await db
        .select({ startDate: courses.startDate, endDate: courses.endDate })
        .from(courses)
        .where(eq(courses.id, dto.courseIds[0]))
        .limit(1);
      const monthsToCompletion =
        primaryCourse?.startDate && primaryCourse?.endDate
          ? Math.max(
              1,
              Math.ceil(
                (new Date(primaryCourse.endDate).getTime() -
                  new Date(primaryCourse.startDate).getTime()) /
                  (30 * 24 * 60 * 60 * 1000),
              ),
            )
          : 1;

      const tabby = this.gatewayFactory.getGateway('tabby') as TabbyGateway;
      return await tabby.prescore({
        amount: Number(quote.totals.totalAmount),
        currency: 'SAR',
        description:
          quote.lineItems.length === 1
            ? `Enrollment: ${quote.lineItems[0].title}`
            : `${quote.lineItems.length} courses`,
        customerName: `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim(),
        customerEmail: userData?.email || user.email,
        customerPhone: plaintextPhone,
        customerRegisteredSince: userData?.createdAt
          ? new Date(userData.createdAt).toISOString()
          : undefined,
        buyerHistory,
        educationDetails: {
          merchantSubtype: 'courses_training',
          monthsToCompletion,
        },
        redirectUrl: 'https://physioguidance.org/payment/callback',
        cancelUrl: 'https://physioguidance.org/checkout',
        webhookUrl: 'https://physioguidance.org/api/webhooks/tabby',
        metadata: {
          // Sentinel so the prescore session is identifiable in Tabby's
          // portal as a pre-check, not a real attempt.
          paymentId: `prescore-${Date.now()}`,
          enrollmentId: 'prescore',
          courseId: dto.courseIds[0],
          courseIds: dto.courseIds,
          userId: user.id,
        },
        locale: dto.locale || 'en',
      });
    } catch (err) {
      this.logger.warn(
        `Tabby prescore failed for user ${user.id}: ${(err as Error).message} — failing open`,
      );
      return { eligible: true };
    }
  }

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

    // VAT now comes from the finance-managed tax settings + the primary
    // course's `vat_treatment` (exempt/zero-rated/standard). For mixed
    // carts the primary course's treatment applies cart-wide — this
    // matches the single taxAmount we store per payment.
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxCalc = await this.taxComputationService.computeForCourse(
      lines[0].course.id,
      taxableAmount,
    );
    const taxAmount = taxCalc.vatAmount;
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
        taxRate: taxCalc.vatRate,
        vatTreatment: taxCalc.treatment,
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

    // 2. Per-course validation: must not be at capacity. Free courses
    // (effective price <= 0) are allowed in a mixed cart — they just
    // contribute 0 to the subtotal. Only block the WHOLE cart if every
    // line is free (then there's nothing to pay and the free-enroll
    // flow should be used instead).
    const lines = orderedCourses.map((course) => {
      const sale = getEffectivePrice(course);
      const salePrice = sale.effectivePrice;
      return { course, sale, salePrice };
    });

    const hasPaidLine = lines.some((l) => l.salePrice > 0);
    if (!hasPaidLine) {
      throw new BadRequestException(
        'All selected courses are free — use the free-enroll flow instead.',
      );
    }

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

    // 6. Calculate totals — VAT comes from finance-managed tax settings
    // + the primary course's vat_treatment override (see TaxComputationService).
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxCalc = await this.taxComputationService.computeForCourse(
      lines[0].course.id,
      taxableAmount,
    );
    const taxAmount = taxCalc.vatAmount;
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
          // Mark stale pending payments for THIS enrollment as ABANDONED so
          // the new cart payment cleanly supersedes the prior attempt. We use
          // 'abandoned' (not 'failed') because the buyer didn't get a gateway
          // decline — they just walked away from the previous checkout.
          // 'failed' is reserved for gateway-declined / receipt-rejected.
          const supersededDirect = await tx
            .update(payments)
            .set({
              status: 'abandoned' as any,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(payments.enrollmentId, existing.id),
                eq(payments.status, PAYMENT_STATUS.PENDING),
              ),
            )
            .returning({ id: payments.id });
          // Also supersede stale pending cart-payments where this course was a line.
          const supersededCart = await tx.execute(
            sql`UPDATE payments
                SET status = 'abandoned',
                    updated_at = NOW()
                WHERE status = ${PAYMENT_STATUS.PENDING}
                  AND id IN (
                    SELECT payment_id FROM payment_items
                    WHERE enrollment_id = ${existing.id}
                  )
                RETURNING id`,
          );
          // Audit every superseded row so the payment drawer shows why it flipped.
          const superseded = [
            ...supersededDirect.map((r) => r.id),
            ...(supersededCart.rows as { id: string }[]).map((r) => r.id),
          ];
          for (const pid of superseded) {
            await this.auditLogService.log({
              entityType: 'payment',
              entityId: pid,
              action: 'payment_abandoned_on_retry',
              performedBy: user.id,
              ipAddress,
              metadata: {
                reason: 'Superseded by new payment attempt',
                supersededByCourseId: course.id,
              },
            });
          }
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
            // VAT snapshot captured at payment time so the invoice PDF
            // renders the rate that applied THEN (ZATCA-compliant — past
            // invoices don't shift if the global rate changes later).
            taxRate: taxCalc.vatRate,
            vatTreatment: taxCalc.treatment,
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
    const checkoutBackUrl =
      lines.length === 1
        ? `${frontendBase}/${dto.locale || 'en'}/checkout?expressCourseId=${lines[0].course.id}`
        : `${frontendBase}/${dto.locale || 'en'}/checkout`;

    // Tabby's QA requires the buyer to land on a page showing their
    // prescribed verbatim copy after cancel/failure — different messages
    // for each outcome. Route both to /payment/failed with distinct
    // outcome params so the failed page renders the right Tabby copy
    // bucket (see tabbyOutcomes.{cancelled,failed} translations).
    // Non-Tabby gateways still go back to /checkout — no QA requirement
    // there and the buyer expects the cart context to retry.
    const cancelUrl =
      dto.gateway === 'tabby'
        ? `${frontendBase}/${dto.locale || 'en'}/payment/failed?gateway=tabby&outcome=cancelled`
        : checkoutBackUrl;
    const failureUrl =
      dto.gateway === 'tabby'
        ? `${frontendBase}/${dto.locale || 'en'}/payment/failed?gateway=tabby&outcome=failed`
        : undefined;

    const [userData] = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        nationalId: users.nationalId,
        dateOfBirth: users.dateOfBirth,
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

    // `users.phone` + `users.national_id` are stored encrypted (AES-GCM,
    // `v1:...` blob) for PII at rest. We need the plaintext both for the
    // Saudi-phone validation below and for handoff to the gateway as
    // `customerPhone` / `customerNationalId`. decryptPII is a no-op on
    // legacy plaintext rows, so this is safe regardless of when the row
    // was written.
    const plaintextPhone = decryptPII(userData?.phone);
    const plaintextNationalId = decryptPII(userData?.nationalId);

    // Both BNPL gateways (Tabby, Tamara) require a Saudi phone number on the
    // buyer. Tabby silently auto-declines its Pre-Scoring without one; Tamara
    // returns a PII-tokenized error ("Invalid v1:...==") that's unreadable
    // when surfaced to the user. Validate + normalize up front so callers get
    // a clear, actionable error instead of a gateway-side failure.
    let normalizedPhone: string | undefined = plaintextPhone || undefined;
    if (dto.gateway === 'tabby' || dto.gateway === 'tamara') {
      if (!plaintextPhone) {
        throw new BadRequestException(
          `${dto.gateway === 'tabby' ? 'Tabby' : 'Tamara'} requires a Saudi phone number on your profile. Please add one in account settings, or use a different payment method.`,
        );
      }
      const candidate = normalizeSaudiPhone(plaintextPhone);
      if (!candidate) {
        throw new BadRequestException(
          `${dto.gateway === 'tabby' ? 'Tabby' : 'Tamara'} only accepts Saudi Arabian phone numbers (e.g. 05XXXXXXXX or +9665XXXXXXXX). Please update your profile or pick a different payment method.`,
        );
      }
      normalizedPhone = candidate;
    }

    // BNPL gateways (Tabby in particular) want a snapshot of the buyer's
    // purchase history for underwriting — order_history + loyalty_level.
    // Compute once here for the BNPL paths so the gateway stays I/O-free.
    // Skipped for non-BNPL gateways to avoid two unused queries per checkout.
    const buyerHistory =
      dto.gateway === 'tabby' || dto.gateway === 'tamara'
        ? await this.buildBuyerHistory(user.id, result.payment.id)
        : undefined;

    // For Tabby's `attachment` (educational vertical). Approx the program
    // length from the primary course's date window; fall back to 1 month if
    // it's open-ended.
    const primaryCourse = lines[0].course;
    const monthsToCompletion =
      primaryCourse.startDate && primaryCourse.endDate
        ? Math.max(
            1,
            Math.ceil(
              (new Date(primaryCourse.endDate).getTime() -
                new Date(primaryCourse.startDate).getTime()) /
                (30 * 24 * 60 * 60 * 1000),
            ),
          )
        : 1;

    let chargeResult: Awaited<ReturnType<typeof gateway.createCharge>>;
    try {
      chargeResult = await gateway.createCharge({
        amount: totalAmount,
        currency: 'SAR',
        description,
        customerName: `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim(),
        customerEmail: userData?.email || user.email,
        customerPhone: normalizedPhone,
        // Tamara needs national_id on the consumer to run their SIMAH check
        // (without it, all installment plans lock at their hosted checkout).
        // Tabby doesn't consume this field. Omit gracefully when the buyer
        // has no NID on file — legacy accounts may still lack one.
        customerNationalId: plaintextNationalId || undefined,
        // ISO YYYY-MM-DD from users.date_of_birth (nullable). Tamara
        // formats to dd-mm-yyyy internally; the gateway does the conversion.
        customerDateOfBirth: userData?.dateOfBirth || undefined,
        customerRegisteredSince: userData?.createdAt
          ? new Date(userData.createdAt).toISOString()
          : undefined,
        buyerHistory,
        educationDetails: {
          // PhysioGuidance is short-form continuing education / CME, not
          // formal degree programs — matches Tabby's 'courses_training' bucket.
          merchantSubtype: 'courses_training',
          monthsToCompletion,
          // Course window (ISO). Tamara requires these on its `education`
          // object; open-ended / self-paced courses omit them and the
          // Tamara gateway falls back to (now, now + monthsToCompletion).
          courseStartDate: primaryCourse.startDate
            ? new Date(primaryCourse.startDate).toISOString().slice(0, 10)
            : undefined,
          courseEndDate: primaryCourse.endDate
            ? new Date(primaryCourse.endDate).toISOString().slice(0, 10)
            : undefined,
        },
        redirectUrl: `${callbackUrl}?gateway=${dto.gateway}&payment_id=${result.payment.id}`,
        cancelUrl,
        ...(failureUrl ? { failureUrl } : {}),
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
        throw new BadRequestException(
          `Payment failed: ${sanitizeGatewayErrorMessage(err.originalMessage, err.gateway)}`,
        );
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
    const activatedEnrollments: { id: string; courseId: string }[] = [];
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
        const activated = await tx
          .update(enrollments)
          .set({
            status: 'active',
            enrolledAt: new Date(),
          })
          .where(inArray(enrollments.id, enrollmentIdsToActivate))
          .returning({ id: enrollments.id, courseId: enrollments.courseId });
        activatedEnrollments.push(...activated);
      }
    });

    if (!won) return; // lost the race — don't double-record usage / audit

    // NELC xAPI — emit 'registered' for each enrollment that just went
    // active. Done outside the transaction so a queue/LRS hiccup can't
    // roll back the payment. Fire-and-forget; the xapi service swallows
    // its own errors.
    for (const e of activatedEnrollments) {
      void this.xapiService.emitCourseEnrollment(
        payment.userId,
        e.courseId,
        e.id,
      );
      // Webinar auto-register — paid checkout path was missing this;
      // students who paid for a course with future webinars need to
      // land in Zoom without filling the registration form themselves.
      // Past webinars are skipped inside the helper.
      void this.enrollmentsService
        .autoRegisterStudentForWebinarCourse(e.courseId, payment.userId)
        .catch((err) =>
          this.logger.warn(`Webinar auto-register (paid) failed: ${err.message}`),
        );
    }

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

  /**
   * Merchant-initiated cancellation of a Tamara order that hasn't been
   * captured yet. Kills the Tamara-side order so the buyer is released from
   * the instalment plan and any authorised hold is voided, then reuses the
   * same downstream cleanup as processPaymentFailure — payment flips to
   * FAILED (schema has no CANCELLED enum value; we distinguish via
   * errorCode='merchant_cancelled' and a dedicated audit action), and any
   * pending enrollments are dropped.
   *
   * Called from the finance admin controller via a reason-gated action.
   * Refuses to cancel:
   *   - non-Tamara payments (refund is the right tool for captured money)
   *   - payments already in a terminal state (paid/failed/refunded/chargeback)
   *   - payments that never reached Tamara (no gatewayChargeId)
   *
   * This matches Tamara's own cancel API contract: their endpoint accepts
   * cancellation only for orders in Approved or Authorised state, not
   * Captured. Captured orders must go through refund.
   */
  async cancelTamaraPayment(
    paymentId: string,
    actor: { id: string; email?: string },
    reason: string,
    ipAddress: string,
  ) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }
    if (payment.gateway !== 'tamara') {
      throw new BadRequestException(
        `Cancel is only supported for Tamara payments (this one is ${payment.gateway})`,
      );
    }
    const terminalStatuses: string[] = [
      PAYMENT_STATUS.PAID,
      PAYMENT_STATUS.FAILED,
      PAYMENT_STATUS.REJECTED,
      PAYMENT_STATUS.REFUNDED,
      PAYMENT_STATUS.PARTIALLY_REFUNDED,
      PAYMENT_STATUS.CHARGEBACK,
      PAYMENT_STATUS.ABANDONED,
    ];
    if (terminalStatuses.includes(payment.status)) {
      throw new ConflictException(
        `Payment ${paymentId} is in terminal state '${payment.status}' — cancel is only valid before capture. Use refund for captured payments.`,
      );
    }
    if (!payment.gatewayChargeId) {
      throw new BadRequestException(
        `Payment ${paymentId} never reached Tamara (no gatewayChargeId) — nothing to cancel on their side. Mark abandoned instead.`,
      );
    }

    const gateway = this.gatewayFactory.getGateway('tamara') as TamaraGateway;
    const cancelResult = await gateway.cancelOrder(payment.gatewayChargeId, {
      amount: Number(payment.amount),
      currency: payment.currency || 'SAR',
      comment: reason,
      cancelId: paymentId,
    });

    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          status: PAYMENT_STATUS.FAILED,
          failedAt: new Date(),
          failureReason: `Cancelled by admin: ${reason}`,
          errorCode: 'merchant_cancelled',
          gatewayResponse: cancelResult.rawResponse || null,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId));

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
      action: 'payment_cancelled_by_admin',
      performedBy: actor.id,
      ipAddress,
      metadata: {
        gateway: 'tamara',
        gatewayChargeId: payment.gatewayChargeId,
        amount: Number(payment.amount),
        currency: payment.currency,
        reason,
        actorEmail: actor.email,
        tamaraStatus: cancelResult.status,
      },
    });

    this.logger.log(
      `Tamara payment ${paymentId} cancelled by ${actor.email || actor.id}: ${reason}`,
    );

    return {
      paymentId,
      status: PAYMENT_STATUS.FAILED,
      tamaraStatus: cancelResult.status,
    };
  }

  /**
   * Chargeback handler. Card-network reversal (Visa/Mastercard/mada via
   * Moyasar) — the bank yanked the money out of our merchant account.
   * Flip the payment to CHARGEBACK and revoke the corresponding enrollment
   * so the student loses access. Idempotent: a row already in CHARGEBACK
   * is a no-op. Audit row is written for both the chargeback transition
   * and the revoked enrollments.
   */
  async processPaymentChargeback(
    paymentId: string,
    reason?: string,
    errorCode?: string,
  ) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment || payment.status === PAYMENT_STATUS.CHARGEBACK) {
      return; // Already chargedback or doesn't exist
    }

    const revokedEnrollmentIds: string[] = [];

    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          status: PAYMENT_STATUS.CHARGEBACK,
          failedAt: new Date(),
          failureReason: reason || 'Chargeback received from card network',
          ...(errorCode ? { errorCode } : {}),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId));

      // Revoke any currently-active enrollments funded by this payment.
      const lineEnrollmentRows = await tx
        .select({ enrollmentId: paymentItems.enrollmentId })
        .from(paymentItems)
        .where(eq(paymentItems.paymentId, paymentId));

      const enrollmentIdsToRevoke = lineEnrollmentRows
        .map((r) => r.enrollmentId)
        .filter((id): id is string => Boolean(id));

      if (enrollmentIdsToRevoke.length === 0 && payment.enrollmentId) {
        enrollmentIdsToRevoke.push(payment.enrollmentId);
      }

      if (enrollmentIdsToRevoke.length > 0) {
        const revoked = await tx
          .update(enrollments)
          .set({ status: ENROLLMENT_STATUS.DROPPED })
          .where(
            and(
              inArray(enrollments.id, enrollmentIdsToRevoke),
              eq(enrollments.status, 'active'),
            ),
          )
          .returning({ id: enrollments.id });
        revokedEnrollmentIds.push(...revoked.map((r) => r.id));
      }
    });

    await this.auditLogService.log({
      entityType: 'payment',
      entityId: paymentId,
      action: 'payment_chargeback',
      performedBy: payment.userId,
      ipAddress: 'system-webhook',
      metadata: {
        gateway: payment.gateway,
        reason: reason || null,
        errorCode: errorCode || null,
        revokedEnrollmentIds,
      },
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
              const message = (err as Error).message;
              this.logger.error(`Invoice generation failed for ${paymentId}: ${message}`);
              try {
                await this.auditLogService.log({
                  entityType: 'payment',
                  entityId: paymentId,
                  action: 'invoice_generation_failed',
                  performedBy: 'system',
                  metadata: { gateway: payment.gateway, source: 'verify', error: message },
                });
              } catch {}
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

  /**
   * Detail view for the Finance Payments page drawer. One round-trip to
   * Postgres returns the payment plus everything finance might want to
   * see on a single transaction: customer, course, invoice, active
   * bank-transfer receipt, ALL refunds, latest reconciliation finding
   * (and its escalation if any). Gateway response JSON is included so
   * the "Gateway Logs" tab can render it without a second fetch.
   */
  async getPaymentDetail(paymentId: string) {
    const [base] = await db
      .select({
        id: payments.id,
        userId: payments.userId,
        userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        userEmail: users.email,
        courseId: payments.courseId,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        gateway: payments.gateway,
        gatewayChargeId: payments.gatewayChargeId,
        paymentMethod: payments.paymentMethod,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        gatewayResponse: payments.gatewayResponse,
        errorCode: payments.errorCode,
        failureReason: payments.failureReason,
        metadata: payments.metadata,
        paidAt: payments.paidAt,
        failedAt: payments.failedAt,
        createdAt: payments.createdAt,
        updatedAt: payments.updatedAt,
        invoiceId: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceStatus: invoices.status,
        invoiceIssuedAt: invoices.issuedAt,
        invoiceTotal: invoices.totalAmount,
      })
      .from(payments)
      .leftJoin(users, eq(payments.userId, users.id))
      .leftJoin(courses, eq(payments.courseId, courses.id))
      .leftJoin(invoices, eq(invoices.paymentId, payments.id))
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!base) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    const [activeReceipt] = await db
      .select({
        id: paymentReceipts.id,
        fileName: paymentReceipts.fileName,
        mimeType: paymentReceipts.mimeType,
        fileSizeBytes: paymentReceipts.fileSizeBytes,
        gcsObjectPath: paymentReceipts.gcsObjectPath,
        scanStatus: paymentReceipts.scanStatus,
        reviewStatus: paymentReceipts.reviewStatus,
        reviewerNote: paymentReceipts.reviewerNote,
        financeInternalNote: paymentReceipts.financeInternalNote,
        reviewedAt: paymentReceipts.reviewedAt,
        uploadedAt: paymentReceipts.createdAt,
        refundAccountHolder: paymentReceipts.refundAccountHolder,
        refundIban: paymentReceipts.refundIban,
        refundBankName: paymentReceipts.refundBankName,
        refundNationalId: paymentReceipts.refundNationalId,
      })
      .from(paymentReceipts)
      .where(
        and(
          eq(paymentReceipts.paymentId, paymentId),
          isNull(paymentReceipts.replacedById),
        ),
      )
      .limit(1);

    // Generate a short-lived signed URL for the receipt file so the drawer
    // can preview/download it. Only computed when the scan is clean — we
    // never expose an infected or scan-failed file to the finance reviewer.
    let receiptWithUrl:
      | (typeof activeReceipt & { downloadUrl: string | null })
      | null = null;
    if (activeReceipt) {
      let downloadUrl: string | null = null;
      if (activeReceipt.scanStatus === 'clean') {
        try {
          downloadUrl = await this.storageService.getSignedUrl(
            'private',
            activeReceipt.gcsObjectPath,
          );
        } catch (err) {
          this.logger.warn(
            `Failed to sign receipt URL for ${activeReceipt.id}: ${(err as Error).message}`,
          );
        }
      }
      receiptWithUrl = { ...activeReceipt, downloadUrl };
    }

    const refundRows = await db
      .select({
        id: refunds.id,
        amount: refunds.refundAmount,
        deductionAmount: refunds.deductionAmount,
        reason: refunds.reason,
        reasonNote: refunds.reasonNote,
        status: refunds.status,
        requestedAt: refunds.createdAt,
        approvedAt: refunds.approvedAt,
        completedAt: refunds.completedAt,
        rejectedAt: refunds.rejectedAt,
        gatewayRefundId: refunds.gatewayRefundId,
      })
      .from(refunds)
      .where(eq(refunds.paymentId, paymentId))
      .orderBy(desc(refunds.createdAt));

    const findingRow = await db
      .select({
        id: reconciliationFindings.id,
        driftType: reconciliationFindings.driftType,
        status: reconciliationFindings.status,
        createdAt: reconciliationFindings.createdAt,
        resolvedAt: reconciliationFindings.resolvedAt,
        escalationId: reconciliationEscalations.id,
        escalationStatus: reconciliationEscalations.status,
        escalationUrgency: reconciliationEscalations.urgency,
        escalationActionTaken: reconciliationEscalations.actionTaken,
      })
      .from(reconciliationFindings)
      .leftJoin(
        reconciliationEscalations,
        eq(reconciliationEscalations.id, reconciliationFindings.escalationId),
      )
      .where(eq(reconciliationFindings.paymentId, paymentId))
      .orderBy(desc(reconciliationFindings.createdAt))
      .limit(1);

    return {
      payment: base,
      receipt: receiptWithUrl,
      refunds: refundRows,
      reconciliation: findingRow[0] || null,
    };
  }

  /**
   * Audit-trail tab on the payment drawer. Reads from the shared
   * audit_logs table filtered to entries where entityId = paymentId AND
   * entityType in the payment-related set (covers refunds + reconciliation
   * actions that name this payment as their entity context).
   */
  async getPaymentAudit(paymentId: string, limit: number = 100) {
    // Audit entries that name this payment as their entity context.
    // We pull from four entity scopes and UNION them so the drawer shows
    // the full lifecycle:
    //   1. entityType='payment' AND entityId=paymentId — direct payment events
    //      (initiated/completed/failed/abandoned/chargeback, bank-transfer
    //      lifecycle, tamara retry, payment_abandoned_on_retry).
    //   2. entityType='refund' for refunds whose paymentId matches —
    //      refund_requested / approved / rejected / completed.
    //   3. entityType='reconciliation_finding' for findings on this payment.
    //   4. entityType='invoice' for the invoice generated for this payment.
    //
    // Same shape as the original method so the existing frontend keeps
    // working; new rows just carry a different entityType label.
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
        (a.entity_type = 'payment' AND a.entity_id = ${paymentId})
        OR (a.entity_type = 'refund' AND a.entity_id IN (
          SELECT id FROM refunds WHERE payment_id = ${paymentId}
        ))
        OR (a.entity_type = 'reconciliation_finding' AND a.entity_id IN (
          SELECT id FROM reconciliation_findings WHERE payment_id = ${paymentId}
        ))
        OR (a.entity_type = 'invoice' AND a.entity_id IN (
          SELECT id FROM invoices WHERE payment_id = ${paymentId}
        ))
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

  async getAllPayments(
    page: number = 1,
    limit: number = 10,
    status?: string,
    search?: string,
    startDate?: string,
    endDate?: string,
    gateway?: string,
    paymentMethod?: string,
    includeAbandoned: boolean = false,
  ) {
    const offset = (page - 1) * limit;
    const conditions: any[] = [];

    if (status && status !== 'all') {
      conditions.push(eq(payments.status, status as any));
    } else if (!includeAbandoned) {
      // Default Payments view hides abandoned rows so finance only sees
      // actionable transactions. Toggle in the UI flips includeAbandoned.
      conditions.push(ne(payments.status, 'abandoned' as any));
    }
    if (gateway && gateway !== 'all') {
      conditions.push(eq(payments.gateway, gateway));
    }
    if (paymentMethod && paymentMethod !== 'all') {
      conditions.push(eq(payments.paymentMethod, paymentMethod));
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
