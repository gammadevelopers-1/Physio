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
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Public } from '../auth/decorators/public.decorator';
import { GatewayFactory } from './gateways/gateway.factory';
import { PaymentsService } from './payments.service';
import { InvoiceService } from './services/invoice.service';
import { EmailService } from '../email/email.service';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import {
  PAYMENT_QUEUE_NAMES,
  PAYMENT_JOB_NAMES,
} from './constants';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly gatewayFactory: GatewayFactory,
    private readonly paymentsService: PaymentsService,
    private readonly invoiceService: InvoiceService,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
    @Optional()
    @InjectQueue(PAYMENT_QUEUE_NAMES.WEBHOOK_PROCESSING)
    private readonly webhookQueue?: Queue,
  ) {}

  @Post(':gateway')
  @Public()
  @HttpCode(200)
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

    // 3. Extract charge info
    const webhookResult = gateway.processWebhook(body);

    // 4. Audit log webhook received
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

    // 5. Process: use queue if available, otherwise process synchronously
    if (this.webhookQueue) {
      await this.webhookQueue.add(PAYMENT_JOB_NAMES.PROCESS_WEBHOOK, {
        gateway: gatewayName,
        chargeId: webhookResult.chargeId,
        status: webhookResult.status,
        rawBody: body,
      });
    } else {
      // Synchronous fallback (no Redis)
      await this.processWebhookSync(
        gatewayName,
        webhookResult.chargeId,
        webhookResult.status,
        body,
      );
    }

    return { received: true };
  }

  private async processWebhookSync(
    gateway: string,
    chargeId: string,
    status: 'paid' | 'failed' | 'refunded',
    rawBody: any,
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
        try {
          await this.emailService.sendPaymentConfirmation(
            payment.userId,
            payment.id,
          );
        } catch (err) {
          this.logger.error(`Payment email failed: ${err.message}`);
        }
      } else if (status === 'failed' && payment.status !== 'failed') {
        await this.paymentsService.processPaymentFailure(payment.id);
        try {
          await this.emailService.sendPaymentFailed(
            payment.userId,
            payment.id,
          );
        } catch (err) {
          this.logger.error(`Payment failure email failed: ${err.message}`);
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
