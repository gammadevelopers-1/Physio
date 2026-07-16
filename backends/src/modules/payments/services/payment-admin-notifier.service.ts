import { Injectable, Logger } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../../database';
import {
  payments,
  courses,
  users,
  PAYMENT_STATUS,
} from '../../../database/schema';
import { EmailService } from '../../email/email.service';
import { UserNotificationsService } from '../../user-notifications/user-notifications.service';

/**
 * Phase G — fan out admin + finance alerts when a payment lands PAID
 * or a bank-transfer receipt awaits review.
 *
 * Design notes:
 *   - Audience is every user with role ADMIN, SUPER_ADMIN, or FINANCE
 *     (the same role set that already receives the Phase B bank-refund
 *     alert). Kept in sync deliberately.
 *   - In-app is a single bulk fanout with i18n keys — each viewer's
 *     locale resolves client-side.
 *   - Email is per-recipient because subject/body must render in the
 *     recipient's `users.language`. Bulk send would flatten to one
 *     language for everyone.
 *   - Never throws upstream; every failure logs. Payment success/receipt
 *     submission is the primary flow — we don't want a stale mail server
 *     to poison it.
 *   - Bank-transfer PAID transitions intentionally skip the "received"
 *     alert (finance just approved it manually; sending them a "payment
 *     received" one second later would be noise). Callers of
 *     notifyPaymentReceived enforce this via the gateway check.
 */
@Injectable()
export class PaymentAdminNotifierService {
  private readonly logger = new Logger(PaymentAdminNotifierService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly userNotificationsService: UserNotificationsService,
  ) {}

  /**
   * Fire the "payment received" alert. Best-effort — logs and swallows
   * every error. Skips silently when gateway === 'bank_transfer' so
   * finance doesn't get an alert right after they manually approved
   * the transfer themselves.
   */
  async notifyPaymentReceived(paymentId: string): Promise<void> {
    try {
      const ctx = await this.loadContext(paymentId);
      if (!ctx) return;
      if (ctx.payment.gateway === 'bank_transfer') {
        // Finance approved it manually — no alert needed.
        return;
      }
      if (ctx.payment.status !== PAYMENT_STATUS.PAID) {
        // Guard: only alert once the payment is actually PAID.
        return;
      }

      const staff = await this.loadStaffAudience();
      if (staff.length === 0) return;

      // In-app link stays as a bare path — the frontend resolves it
      // against its own origin. Email needs an absolute URL because
      // Gmail/browsers can't infer host from `/dashboard/...`.
      const inAppLink = `/dashboard/admin/finance?tab=payments&paymentId=${ctx.payment.id}`;
      const financeUrl = `${this.frontendBase()}${inAppLink}`;

      await this.userNotificationsService
        .createBulk(
          staff.map((s) => s.id),
          {
            type: 'payment_received_admin',
            title: `Payment received — ${ctx.courseName}`,
            message: `${ctx.buyerName} paid ${ctx.amountFormatted} ${ctx.payment.currency} for "${ctx.courseName}" via ${ctx.gatewayLabel}.`,
            titleKey: 'notifications.types.payment_received_admin.title',
            messageKey: 'notifications.types.payment_received_admin.message',
            titleParams: { courseName: ctx.courseName },
            messageParams: {
              buyerName: ctx.buyerName,
              amount: ctx.amountFormatted,
              currency: ctx.payment.currency,
              courseName: ctx.courseName,
              gateway: ctx.gatewayLabel,
            },
            link: inAppLink,
            entityType: 'payment',
            entityId: ctx.payment.id,
          },
        )
        .catch((err) =>
          this.logger.warn(
            `notifyPaymentReceived: in-app fanout failed for ${paymentId}: ${
              (err as Error).message
            }`,
          ),
        );
      await Promise.all(
        staff.map((s) =>
          this.emailService.sendAdminPaymentReceived(
            s.email,
            {
              recipientName: s.firstName ?? s.email ?? 'Team',
              buyerName: ctx.buyerName,
              courseName: ctx.courseName,
              amount: ctx.amountFormatted,
              currency: ctx.payment.currency,
              gateway: ctx.gatewayLabel,
              paymentId: ctx.payment.id,
              financeUrl,
            },
            s.language === 'ar' ? 'ar' : 'en',
          ),
        ),
      );
    } catch (err) {
      this.logger.error(
        `notifyPaymentReceived failed for ${paymentId}`,
        err as Error,
      );
    }
  }

  /**
   * Fire the "bank-transfer pending review" alert. Called when a
   * bank-transfer receipt has been uploaded and the payment enters
   * AWAITING_APPROVAL. Never fires for other gateways.
   */
  async notifyBankTransferPending(paymentId: string): Promise<void> {
    try {
      const ctx = await this.loadContext(paymentId);
      if (!ctx) return;
      if (ctx.payment.gateway !== 'bank_transfer') return;

      const staff = await this.loadStaffAudience();
      if (staff.length === 0) return;

      const submittedAt = new Date()
        .toISOString()
        .replace('T', ' ')
        .slice(0, 16);

      const inAppLink = `/dashboard/admin/finance?tab=bank-transfers&status=pending`;
      const reviewUrl = `${this.frontendBase()}${inAppLink}`;

      await this.userNotificationsService
        .createBulk(
          staff.map((s) => s.id),
          {
            type: 'bank_transfer_pending_review',
            title: `Bank transfer pending review — ${ctx.courseName}`,
            message: `${ctx.buyerName} submitted a bank transfer of ${ctx.amountFormatted} ${ctx.payment.currency} for "${ctx.courseName}". Review the uploaded receipt in Finance → Bank Transfers.`,
            titleKey: 'notifications.types.bank_transfer_pending_review.title',
            messageKey:
              'notifications.types.bank_transfer_pending_review.message',
            titleParams: { courseName: ctx.courseName },
            messageParams: {
              buyerName: ctx.buyerName,
              amount: ctx.amountFormatted,
              currency: ctx.payment.currency,
              courseName: ctx.courseName,
            },
            link: inAppLink,
            entityType: 'payment',
            entityId: ctx.payment.id,
          },
        )
        .catch((err) =>
          this.logger.warn(
            `notifyBankTransferPending: in-app fanout failed for ${paymentId}: ${
              (err as Error).message
            }`,
          ),
        );
      await Promise.all(
        staff.map((s) =>
          this.emailService.sendAdminBankTransferPending(
            s.email,
            {
              recipientName: s.firstName ?? s.email ?? 'Team',
              buyerName: ctx.buyerName,
              courseName: ctx.courseName,
              amount: ctx.amountFormatted,
              currency: ctx.payment.currency,
              submittedAt,
              reviewUrl,
            },
            s.language === 'ar' ? 'ar' : 'en',
          ),
        ),
      );
    } catch (err) {
      this.logger.error(
        `notifyBankTransferPending failed for ${paymentId}`,
        err as Error,
      );
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async loadContext(paymentId: string) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);
    if (!payment) return null;

    const [buyer] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, payment.userId))
      .limit(1);

    const [course] = await db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(eq(courses.id, payment.courseId))
      .limit(1);

    const buyerName =
      buyer &&
      `${buyer.firstName ?? ''} ${buyer.lastName ?? ''}`.trim().length > 0
        ? `${buyer.firstName ?? ''} ${buyer.lastName ?? ''}`.trim()
        : buyer?.email ?? 'Unknown buyer';

    return {
      payment,
      courseName: course?.title ?? 'Course',
      buyerName,
      amountFormatted: String(payment.amount),
      gatewayLabel: this.humaniseGateway(payment.gateway),
    };
  }

  private async loadStaffAudience() {
    return db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        language: users.language,
      })
      .from(users)
      .where(inArray(users.activeRole, ['ADMIN', 'SUPER_ADMIN', 'FINANCE']));
  }

  private frontendBase(): string {
    // Strip a trailing slash so we can concat with '/dashboard/...' safely.
    const raw =
      process.env.FRONTEND_URL || 'https://physioguidance.org';
    return raw.replace(/\/$/, '');
  }

  private humaniseGateway(gateway: string): string {
    switch (gateway) {
      case 'moyasar':
        return 'Moyasar';
      case 'tamara':
        return 'Tamara';
      case 'tabby':
        return 'Tabby';
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'mock':
        return 'Mock';
      default:
        return gateway;
    }
  }
}
