import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PAYMENT_QUEUE_NAMES } from '../constants';
import { PaymentsService } from '../payments.service';
import { InvoiceService } from '../services/invoice.service';
import { RefundService } from '../services/refund.service';
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
    private readonly refundService: RefundService,
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

        // Get invoice PDF for email attachment
        let pdfAttachment: { buffer: Buffer; filename: string } | undefined;
        try {
          const pdf = await this.invoiceService.getInvoicePdfBuffer(payment.id);
          if (pdf) pdfAttachment = pdf;
        } catch (err) {
          this.logger.error(
            `Failed to get invoice PDF for attachment: ${err.message}`,
          );
        }

        // Send confirmation email with invoice PDF attached
        try {
          await this.emailService.sendPaymentConfirmation(
            payment.userId,
            payment.id,
            pdfAttachment,
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
        // Extract machine-readable error code from gateway response
        let errorCode: string | undefined;
        if (gateway === 'tap') {
          errorCode = rawBody?.response?.code;
        } else if (gateway === 'moyasar') {
          errorCode = rawBody?.source?.message;
        } else if (gateway === 'tamara' || gateway === 'tabby') {
          errorCode = rawBody?.error_code || rawBody?.status;
        }

        await this.paymentsService.processPaymentFailure(
          payment.id,
          'Payment failed via webhook',
          errorCode,
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
        // Find the active refund for this payment and complete it
        try {
          const { refunds } = await import('../../../database/schema');
          const { and, inArray } = await import('drizzle-orm');

          const [refund] = await db
            .select({ id: refunds.id })
            .from(refunds)
            .where(
              and(
                eq(refunds.paymentId, payment.id),
                inArray(refunds.status, ['approved', 'processing']),
              ),
            )
            .limit(1);

          if (refund) {
            await this.refundService.completeRefund(refund.id);
            this.logger.log(
              `Refund ${refund.id} completed via webhook for payment ${payment.id}`,
            );
          } else {
            this.logger.warn(
              `Refund webhook received for payment ${payment.id} but no active refund found`,
            );
          }
        } catch (err) {
          this.logger.error(
            `Failed to process refund webhook for payment ${payment.id}: ${err.message}`,
          );
        }

        await this.auditLogService.log({
          entityType: 'webhook',
          entityId: chargeId,
          action: 'webhook_processed',
          performedBy: 'system',
          metadata: { gateway, status: 'refunded', paymentId: payment.id },
        });
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
