import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PAYMENT_QUEUE_NAMES } from '../constants';
import { PaymentsService } from '../payments.service';
import { InvoiceService } from '../services/invoice.service';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { EmailService } from '../../email/email.service';

interface WebhookJobData {
  gateway: string;
  chargeId: string;
  status: 'paid' | 'failed' | 'refunded';
  rawBody: any;
}

@Processor(PAYMENT_QUEUE_NAMES.WEBHOOK_PROCESSING, { concurrency: 1 })
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly invoiceService: InvoiceService,
    private readonly auditLogService: AuditLogService,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { gateway, chargeId, status, rawBody } = job.data;

    this.logger.log(
      `Processing webhook: gateway=${gateway}, chargeId=${chargeId}, status=${status}`,
    );

    try {
      // Find payment by gateway charge ID
      const payment = await this.paymentsService.getPaymentByChargeId(chargeId);

      if (!payment) {
        this.logger.warn(`No payment found for chargeId: ${chargeId}`);
        return;
      }

      // Idempotency: skip if already in terminal state
      if (payment.status === 'paid' && status === 'paid') {
        this.logger.log(
          `Payment ${payment.id} already paid, skipping duplicate webhook`,
        );
        return;
      }

      if (payment.status === 'failed' && status === 'failed') {
        this.logger.log(
          `Payment ${payment.id} already failed, skipping duplicate webhook`,
        );
        return;
      }

      // Store raw webhook response
      const { db } = await import('../../../database');
      const { payments } = await import('../../../database/schema');
      const { eq } = await import('drizzle-orm');

      await db
        .update(payments)
        .set({ gatewayResponse: rawBody, updatedAt: new Date() })
        .where(eq(payments.id, payment.id));

      if (status === 'paid') {
        await this.paymentsService.processPaymentSuccess(payment.id);

        // Generate invoice
        try {
          await this.invoiceService.generateInvoice(payment.id);
        } catch (err) {
          this.logger.error(
            `Failed to generate invoice for payment ${payment.id}: ${err.message}`,
          );
        }

        // Send confirmation email
        try {
          await this.emailService.sendPaymentConfirmation(
            payment.userId,
            payment.id,
          );
        } catch (err) {
          this.logger.error(
            `Failed to send payment confirmation email: ${err.message}`,
          );
        }

        await this.auditLogService.log({
          entityType: 'webhook',
          entityId: chargeId,
          action: 'webhook_processed',
          performedBy: 'system',
          metadata: { gateway, status, paymentId: payment.id },
        });
      } else if (status === 'failed') {
        await this.paymentsService.processPaymentFailure(
          payment.id,
          'Payment failed via webhook',
        );

        // Send failure email
        try {
          await this.emailService.sendPaymentFailed(
            payment.userId,
            payment.id,
          );
        } catch (err) {
          this.logger.error(
            `Failed to send payment failure email: ${err.message}`,
          );
        }

        await this.auditLogService.log({
          entityType: 'webhook',
          entityId: chargeId,
          action: 'webhook_processed',
          performedBy: 'system',
          metadata: { gateway, status: 'failed', paymentId: payment.id },
        });
      } else if (status === 'refunded') {
        // Refund completion handled by RefundService
        this.logger.log(
          `Refund webhook for payment ${payment.id} — handled by RefundService`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Webhook processing failed: ${error.message}`,
        error.stack,
      );

      await this.auditLogService.log({
        entityType: 'webhook',
        entityId: chargeId,
        action: 'webhook_failed',
        performedBy: 'system',
        metadata: { gateway, error: error.message },
      });

      throw error; // Let BullMQ retry
    }
  }
}
