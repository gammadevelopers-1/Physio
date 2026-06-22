import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  Logger,
  UnauthorizedException,
  HttpCode,
  Optional,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Public } from '../auth/decorators/public.decorator';
import { GatewayFactory } from './gateways/gateway.factory';
import { PaymentsService } from './payments.service';
import { InvoiceService } from './services/invoice.service';
import { RefundService } from './services/refund.service';
import { EmailService } from '../email/email.service';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import {
  PAYMENT_QUEUE_NAMES,
  PAYMENT_JOB_NAMES,
} from './constants';

/** TTL for webhook dedup entries (1 hour in ms) */
const WEBHOOK_DEDUP_TTL = 60 * 60 * 1000;
/** Maximum webhook age tolerance (5 minutes in ms) */
const WEBHOOK_MAX_AGE = 5 * 60 * 1000;

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  /** In-memory deduplication map: key → timestamp of first receipt */
  private readonly processedWebhooks = new Map<string, number>();
  private dedupCleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly gatewayFactory: GatewayFactory,
    private readonly paymentsService: PaymentsService,
    private readonly invoiceService: InvoiceService,
    private readonly refundService: RefundService,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
    @Optional()
    @InjectQueue(PAYMENT_QUEUE_NAMES.WEBHOOK_PROCESSING)
    private readonly webhookQueue?: Queue,
  ) {
    // Clean up expired dedup entries every 5 minutes
    this.dedupCleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, ts] of this.processedWebhooks) {
        if (now - ts > WEBHOOK_DEDUP_TTL) {
          this.processedWebhooks.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Check if a webhook has already been processed (dedup).
   * Returns true if this is a duplicate that should be skipped.
   */
  private isDuplicate(gateway: string, chargeId: string): boolean {
    const key = `webhook:${gateway}:${chargeId}`;
    if (this.processedWebhooks.has(key)) {
      return true;
    }
    this.processedWebhooks.set(key, Date.now());
    return false;
  }

  /**
   * Extract and validate webhook timestamp to prevent replay attacks.
   * Returns true if the webhook is stale and should be rejected.
   */
  private isStaleWebhook(gateway: string, body: any): boolean {
    let webhookTime: number | null = null;

    if (gateway === 'moyasar' && body.created_at) {
      webhookTime = new Date(body.created_at).getTime();
    } else if ((gateway === 'tamara' || gateway === 'tabby') && (body.timestamp || body.created_at)) {
      webhookTime = new Date(body.timestamp || body.created_at).getTime();
    }

    // If no timestamp available, skip validation (some gateways don't include one)
    if (!webhookTime || isNaN(webhookTime)) {
      return false;
    }

    const age = Math.abs(Date.now() - webhookTime);
    return age > WEBHOOK_MAX_AGE;
  }

  @Post(':gateway')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  async handleWebhook(
    @Param('gateway') gatewayName: string,
    @Headers() headers: Record<string, string>,
    @Body() body: any,
  ) {
    this.logger.log(`Webhook received from ${gatewayName}`);

    // 1. Get gateway adapter
    const gateway = this.gatewayFactory.getGateway(gatewayName);

    // 2. Verify webhook signature
    if (!gateway.verifyWebhook(headers, body)) {
      this.logger.warn(
        `Webhook signature verification failed for ${gatewayName}`,
      );
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // 3. Extract charge info. Some gateways (Tamara) make follow-up API
    //    calls inside processWebhook to authorise + capture the order
    //    before answering 'paid', so this is async.
    const webhookResult = await gateway.processWebhook(body);

    // 4. Skip non-terminal statuses (e.g. Tamara pre-authorise retries)
    if (webhookResult.status === 'pending') {
      this.logger.log(
        `Non-terminal webhook ignored: ${gatewayName}/${webhookResult.chargeId} (status=pending)`,
      );
      return { received: true };
    }

    // 6. Deduplication check — skip if already processed
    if (this.isDuplicate(gatewayName, webhookResult.chargeId)) {
      this.logger.log(
        `Duplicate webhook skipped: ${gatewayName}/${webhookResult.chargeId}`,
      );
      return { received: true, duplicate: true };
    }

    // 7. Timestamp validation — reject stale webhooks (replay protection)
    if (this.isStaleWebhook(gatewayName, body)) {
      this.logger.warn(
        `Stale webhook rejected: ${gatewayName}/${webhookResult.chargeId}`,
      );
      return { received: true, rejected: true, reason: 'stale' };
    }

    // 8. Audit log webhook received
    await this.auditLogService.log({
      entityType: 'webhook',
      entityId: webhookResult.chargeId,
      action: 'webhook_received',
      performedBy: 'system',
      metadata: {
        gateway: gatewayName,
        status: webhookResult.status,
        chargeId: webhookResult.chargeId,
      },
    });

    // 9. Process: use queue if available, otherwise process synchronously
    if (this.webhookQueue) {
      await this.webhookQueue.add(PAYMENT_JOB_NAMES.PROCESS_WEBHOOK, {
        gateway: gatewayName,
        chargeId: webhookResult.chargeId,
        status: webhookResult.status,
        errorCode: webhookResult.errorCode,
        rawBody: body,
      });
    } else {
      // Synchronous fallback (no Redis)
      await this.processWebhookSync(
        gatewayName,
        webhookResult.chargeId,
        webhookResult.status,
        body,
        webhookResult.errorCode,
      );
    }

    return { received: true };
  }

  private async processWebhookSync(
    gateway: string,
    chargeId: string,
    status: 'paid' | 'failed' | 'refunded' | 'chargeback',
    rawBody: any,
    errorCode?: string,
  ) {
    try {
      const payment =
        await this.paymentsService.getPaymentByChargeId(chargeId);
      if (!payment) {
        this.logger.warn(`No payment found for chargeId: ${chargeId}`);
        return;
      }

      // Store raw response
      const { db } = await import('../../database');
      const { payments } = await import('../../database/schema');
      const { eq } = await import('drizzle-orm');
      await db
        .update(payments)
        .set({ gatewayResponse: rawBody, updatedAt: new Date() })
        .where(eq(payments.id, payment.id));

      if (status === 'paid' && payment.status !== 'paid') {
        await this.paymentsService.processPaymentSuccess(payment.id);
        try {
          await this.invoiceService.generateInvoice(payment.id);
        } catch (err) {
          this.logger.error(`Invoice generation failed: ${err.message}`);
        }

        // Get invoice PDF for email attachment
        let pdfAttachment: { buffer: Buffer; filename: string } | undefined;
        try {
          const pdf = await this.invoiceService.getInvoicePdfBuffer(payment.id);
          if (pdf) pdfAttachment = pdf;
        } catch (err) {
          this.logger.error(`Failed to get invoice PDF for attachment: ${err.message}`);
        }

        try {
          await this.emailService.sendPaymentConfirmation(
            payment.userId,
            payment.id,
            pdfAttachment,
          );
        } catch (err) {
          this.logger.error(`Payment email failed: ${err.message}`);
        }
      } else if (status === 'failed' && payment.status !== 'failed') {
        await this.paymentsService.processPaymentFailure(payment.id, 'Payment failed via webhook', errorCode);
        try {
          await this.emailService.sendPaymentFailed(
            payment.userId,
            payment.id,
          );
        } catch (err) {
          this.logger.error(`Payment failure email failed: ${err.message}`);
        }
      } else if (status === 'chargeback' && payment.status !== 'chargeback') {
        // Card-network reversal — revoke enrollment + flip status. Card
        // gateways (Moyasar) are the only path that fires this; BNPL +
        // bank transfer can't chargeback in the network sense.
        await this.paymentsService.processPaymentChargeback(
          payment.id,
          rawBody?.data?.refunded_reason || rawBody?.data?.message || 'Chargeback received',
          errorCode,
        );
      } else if (status === 'refunded') {
        try {
          const { refunds } = await import('../../database/schema');
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
      }

      await this.auditLogService.log({
        entityType: 'webhook',
        entityId: chargeId,
        action: 'webhook_processed',
        performedBy: 'system',
        metadata: { gateway, status, paymentId: payment.id },
      });
    } catch (error) {
      this.logger.error(`Webhook sync processing failed: ${error.message}`);
      await this.auditLogService.log({
        entityType: 'webhook',
        entityId: chargeId,
        action: 'webhook_failed',
        performedBy: 'system',
        metadata: { gateway, error: error.message },
      });
    }
  }
}
