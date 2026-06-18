import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { eq, and, lt, isNotNull, sql } from 'drizzle-orm';
import { db } from '../../../database';
import {
  payments,
  PAYMENT_STATUS,
} from '../../../database/schema';
import { GatewayFactory } from '../gateways/gateway.factory';
import { TamaraGateway } from '../gateways/tamara.gateway';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { EmailService } from '../../email/email.service';
import { PaymentsService } from '../payments.service';
import { InvoiceService } from './invoice.service';
import type { TamaraStuckSeverity } from '../../email/templates/tamara-stuck-alert.template';

/**
 * Background retry + escalation for Tamara payments where the webhook arrived
 * but our Authorise/Capture calls failed (or the webhook is somehow delayed).
 *
 * Why this exists:
 *   Tamara fires order_approved when the buyer pays first instalment. We MUST
 *   call Authorise + Capture within 72 hours or Tamara auto-cancels the order
 *   and refunds the buyer (the student would have got the course free).
 *   TamaraGateway.processWebhook now calls Authorise+Capture inline, but a
 *   transient gateway-side failure leaves the payment in PENDING. Tamara
 *   retries the webhook for ~24h on its own; this service is our defence-
 *   in-depth covering hours 24-72.
 *
 * Behaviour:
 *   - Every 10 minutes, scan for Tamara payments stuck in PENDING with a
 *     gatewayChargeId (i.e. the buyer reached Tamara).
 *   - For each, ask Tamara what state it's in via getCharge:
 *       * fully_captured / captured → flip our payment to PAID + enroll
 *       * approved / authorised     → call authorise + capture again
 *       * expired / declined / cancelled → mark payment as failed
 *       * refunded → mark refunded
 *   - Email finance / admin / super_admin at 24h / 48h / 60h thresholds,
 *     once per threshold (tracked in payment.metadata.tamaraAlertedAt).
 */
@Injectable()
export class TamaraRetryService {
  private readonly logger = new Logger(TamaraRetryService.name);

  // Don't churn on payments that just arrived — give Tamara's own webhook
  // retry a fair chance first.
  private readonly MIN_AGE_MS = 5 * 60 * 1000; // 5 minutes

  // Tamara cancels at 72h. We escalate at 24h / 48h / 60h.
  private readonly ALERT_THRESHOLDS_HOURS = [24, 48, 60] as const;

  // Hard upper bound — once we cross this, give up the auto-retry and
  // mark the payment failed. Finance can still manually retry from the
  // dashboard until Tamara's 72h cancel fires.
  private readonly GIVE_UP_HOURS = 71;

  constructor(
    private readonly gatewayFactory: GatewayFactory,
    private readonly paymentsService: PaymentsService,
    private readonly invoiceService: InvoiceService,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Cron('0 */10 * * * *')
  async retryStuckOrders(): Promise<void> {
    const minAge = new Date(Date.now() - this.MIN_AGE_MS);

    let stuck: { id: string; createdAt: Date; metadata: any; gatewayChargeId: string | null }[];
    try {
      stuck = await db
        .select({
          id: payments.id,
          createdAt: payments.createdAt,
          metadata: payments.metadata,
          gatewayChargeId: payments.gatewayChargeId,
        })
        .from(payments)
        .where(
          and(
            eq(payments.gateway, 'tamara'),
            eq(payments.status, PAYMENT_STATUS.PENDING),
            isNotNull(payments.gatewayChargeId),
            lt(payments.createdAt, minAge),
          ),
        )
        .limit(50);
    } catch (err) {
      this.logger.error(
        `Tamara retry sweep: query failed: ${(err as Error).message}`,
      );
      return;
    }

    if (stuck.length === 0) return;
    this.logger.log(`Tamara retry sweep: ${stuck.length} stuck payment(s)`);

    for (const p of stuck) {
      try {
        await this.retryOne(p.id, 'system-cron');
      } catch (err) {
        // retryOne catches its own errors and writes them to metadata —
        // anything that bubbles out here is unexpected. Don't let one
        // bad row kill the whole sweep.
        this.logger.error(
          `Tamara retry sweep: unexpected error on ${p.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Retry a single Tamara payment — runs the same authorise+capture logic
   * the webhook handler does, plus failure escalation. Called from:
   *   - the cron sweep above
   *   - the Finance dashboard "Retry capture" button (performedBy = user id)
   */
  async retryOne(paymentId: string, performedBy: string): Promise<{
    paymentId: string;
    action: 'paid' | 'failed' | 'refunded' | 'retried' | 'no_op';
    detail: string;
  }> {
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
        `Payment ${paymentId} is not a Tamara payment (gateway=${payment.gateway})`,
      );
    }
    if (payment.status === PAYMENT_STATUS.PAID) {
      return { paymentId, action: 'no_op', detail: 'Already paid' };
    }
    if (
      payment.status === PAYMENT_STATUS.FAILED ||
      payment.status === PAYMENT_STATUS.REFUNDED
    ) {
      return {
        paymentId,
        action: 'no_op',
        detail: `Payment is in terminal state '${payment.status}'`,
      };
    }
    if (!payment.gatewayChargeId) {
      // Never reached the gateway — let PaymentCleanupService handle this
      // via the 2-hour PENDING expiry sweep.
      return {
        paymentId,
        action: 'no_op',
        detail: 'No gatewayChargeId — buyer never reached Tamara',
      };
    }

    const ageMs = Date.now() - new Date(payment.createdAt).getTime();
    const hoursStuck = Math.floor(ageMs / (60 * 60 * 1000));

    const gateway = this.gatewayFactory.getGateway('tamara') as TamaraGateway;

    // Step 1: ask Tamara what state the order is in. We use this to decide
    // whether to authorise + capture, give up, or just flip our DB to match.
    let remoteStatus: string;
    try {
      remoteStatus = await gateway
        .getPaymentStatus(payment.gatewayChargeId)
        .then((s) => s);
    } catch (err) {
      const errMsg = (err as Error).message;
      this.logger.warn(
        `Tamara retry: getPaymentStatus failed for payment ${paymentId}: ${errMsg}`,
      );
      await this.recordAttempt(payment, errMsg);
      await this.maybeEscalate(payment, hoursStuck, errMsg);
      return { paymentId, action: 'retried', detail: `Lookup failed: ${errMsg}` };
    }

    // Tamara already settled (somehow our webhook handling missed it) →
    // flip our DB to match and run the same post-success steps the webhook
    // path runs (invoice + email + enrollment activation).
    if (remoteStatus === 'paid') {
      await this.paymentsService.processPaymentSuccess(paymentId);
      // Generate invoice + confirmation email outside the critical path.
      try {
        await this.invoiceService.generateInvoice(paymentId);
      } catch (err) {
        this.logger.error(
          `Tamara retry: invoice generation failed for ${paymentId}: ${(err as Error).message}`,
        );
      }
      try {
        let pdf: { buffer: Buffer; filename: string } | undefined;
        try {
          const buf = await this.invoiceService.getInvoicePdfBuffer(paymentId);
          if (buf) pdf = buf;
        } catch { /* non-fatal */ }
        await this.emailService.sendPaymentConfirmation(
          payment.userId,
          paymentId,
          pdf,
        );
      } catch (err) {
        this.logger.error(
          `Tamara retry: confirmation email failed for ${paymentId}: ${(err as Error).message}`,
        );
      }
      await this.auditLogService.log({
        entityType: 'payment',
        entityId: paymentId,
        action: 'tamara_retry_resolved_paid',
        performedBy,
        metadata: { gatewayChargeId: payment.gatewayChargeId, hoursStuck },
      });
      return { paymentId, action: 'paid', detail: 'Tamara order was already captured' };
    }

    // Tamara terminal-failure states → mark our payment as failed too.
    if (remoteStatus === 'failed' || remoteStatus === 'cancelled') {
      await this.paymentsService.processPaymentFailure(
        paymentId,
        `Tamara order ${remoteStatus}`,
        'tamara_terminal_failure',
      );
      await this.auditLogService.log({
        entityType: 'payment',
        entityId: paymentId,
        action: 'tamara_retry_resolved_failed',
        performedBy,
        metadata: { gatewayChargeId: payment.gatewayChargeId, remoteStatus, hoursStuck },
      });
      return { paymentId, action: 'failed', detail: `Tamara order is ${remoteStatus}` };
    }

    if (remoteStatus === 'refunded') {
      await this.paymentsService.processPaymentFailure(
        paymentId,
        'Tamara order refunded externally',
        'tamara_refunded',
      );
      return { paymentId, action: 'refunded', detail: 'Tamara order refunded' };
    }

    // remoteStatus === 'pending' means Tamara has the order in approved or
    // authorised state — we still need to authorise+capture. The Tamara API
    // is idempotent so calling either step twice is safe.
    if (remoteStatus !== 'pending' && remoteStatus !== 'unknown') {
      this.logger.warn(
        `Tamara retry: unexpected remote status '${remoteStatus}' for payment ${paymentId}`,
      );
    }

    // Step 2: attempt authorise + capture. Both methods are idempotent
    // (authorise returns 409 if already authorised; capture returns the
    // existing capture). The amount comes from the payment row.
    try {
      await gateway.authoriseOrder(payment.gatewayChargeId);
      await gateway.captureOrder(
        payment.gatewayChargeId,
        Number(payment.amount),
        payment.currency,
      );
    } catch (err) {
      const errMsg = (err as Error).message;
      this.logger.warn(
        `Tamara retry: authorise/capture failed for ${paymentId}: ${errMsg}`,
      );
      await this.recordAttempt(payment, errMsg);

      // Hard ceiling: if we've blown past GIVE_UP_HOURS, mark failed so the
      // finance dashboard doesn't keep showing this as "retrying" forever.
      // Tamara will auto-cancel + refund the buyer at 72h regardless.
      if (hoursStuck >= this.GIVE_UP_HOURS) {
        await this.paymentsService.processPaymentFailure(
          paymentId,
          `Tamara retry exhausted after ${hoursStuck}h (last error: ${errMsg})`,
          'tamara_retry_exhausted',
        );
        await this.auditLogService.log({
          entityType: 'payment',
          entityId: paymentId,
          action: 'tamara_retry_gave_up',
          performedBy,
          metadata: { gatewayChargeId: payment.gatewayChargeId, hoursStuck, lastError: errMsg },
        });
        return { paymentId, action: 'failed', detail: `Gave up after ${hoursStuck}h` };
      }

      await this.maybeEscalate(payment, hoursStuck, errMsg);
      return { paymentId, action: 'retried', detail: errMsg };
    }

    // Authorise + Capture both succeeded — run the same path the webhook
    // would have run had it succeeded first time.
    await this.paymentsService.processPaymentSuccess(paymentId);
    try {
      await this.invoiceService.generateInvoice(paymentId);
    } catch (err) {
      this.logger.error(
        `Tamara retry: invoice generation failed for ${paymentId}: ${(err as Error).message}`,
      );
    }
    try {
      let pdf: { buffer: Buffer; filename: string } | undefined;
      try {
        const buf = await this.invoiceService.getInvoicePdfBuffer(paymentId);
        if (buf) pdf = buf;
      } catch { /* non-fatal */ }
      await this.emailService.sendPaymentConfirmation(
        payment.userId,
        paymentId,
        pdf,
      );
    } catch (err) {
      this.logger.error(
        `Tamara retry: confirmation email failed for ${paymentId}: ${(err as Error).message}`,
      );
    }
    await this.auditLogService.log({
      entityType: 'payment',
      entityId: paymentId,
      action: 'tamara_retry_resolved_captured',
      performedBy,
      metadata: { gatewayChargeId: payment.gatewayChargeId, hoursStuck },
    });
    return { paymentId, action: 'paid', detail: `Captured after ${hoursStuck}h` };
  }

  /** Record a retry attempt + last-error in the payment's metadata blob. */
  private async recordAttempt(
    payment: { id: string; metadata: any },
    error: string,
  ): Promise<void> {
    const meta = (payment.metadata as any) || {};
    const attempts = Number(meta.tamaraCaptureAttempts || 0) + 1;
    const updated = {
      ...meta,
      tamaraCaptureAttempts: attempts,
      tamaraLastCaptureError: error.slice(0, 500),
      tamaraLastCaptureAt: new Date().toISOString(),
    };
    await db
      .update(payments)
      .set({ metadata: updated, updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
  }

  /**
   * Fire the first email alert at each threshold we've crossed. Skips
   * thresholds already alerted in metadata.tamaraAlertedAt so finance
   * doesn't get 6 emails per stuck payment per hour.
   */
  private async maybeEscalate(
    payment: { id: string; metadata: any; gatewayChargeId: string | null },
    hoursStuck: number,
    lastError: string,
  ): Promise<void> {
    const meta = (payment.metadata as any) || {};
    const alertedAt: Record<string, string> = meta.tamaraAlertedAt || {};

    let toFire: TamaraStuckSeverity | null = null;
    if (hoursStuck >= 60 && !alertedAt['60']) toFire = 'critical';
    else if (hoursStuck >= 48 && !alertedAt['48']) toFire = 'urgent';
    else if (hoursStuck >= 24 && !alertedAt['24']) toFire = 'warning';

    if (!toFire) return;

    const attempts = Number(meta.tamaraCaptureAttempts || 0);
    const hoursUntilExpiry = Math.max(0, 72 - hoursStuck);

    try {
      await this.emailService.sendTamaraStuckAlert(payment.id, toFire, {
        hoursStuck,
        hoursUntilExpiry,
        attempts,
        lastError,
      });
    } catch (err) {
      this.logger.error(
        `Tamara escalation email failed for ${payment.id}: ${(err as Error).message}`,
      );
      return; // do NOT mark the threshold as alerted — try again next cron tick
    }

    const thresholdKey =
      toFire === 'critical' ? '60' : toFire === 'urgent' ? '48' : '24';
    const newAlertedAt = { ...alertedAt, [thresholdKey]: new Date().toISOString() };
    await db
      .update(payments)
      .set({
        metadata: { ...meta, tamaraAlertedAt: newAlertedAt, tamaraCaptureAttempts: attempts },
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    await this.auditLogService.log({
      entityType: 'payment',
      entityId: payment.id,
      action: 'tamara_stuck_alert_sent',
      performedBy: 'system',
      metadata: { severity: toFire, hoursStuck, hoursUntilExpiry, attempts },
    });
  }
}
