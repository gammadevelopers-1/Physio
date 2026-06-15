import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

// Controllers
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { InvoicesController } from './invoices/invoices.controller';
import { RefundsController } from './refunds/refunds.controller';
import { DiscountsController } from './discounts/discounts.controller';
import { FinanceController } from './finance/finance.controller';

// Services
import { PaymentsService } from './payments.service';
import { InvoiceService } from './services/invoice.service';
import { RefundService } from './services/refund.service';
import { DiscountService } from './services/discount.service';
import { FinanceService } from './services/finance.service';
import { PaymentCleanupService } from './services/payment-cleanup.service';

// Gateways
import { GatewayFactory } from './gateways/gateway.factory';
import { MockGateway } from './gateways/mock.gateway';
import { TapGateway } from './gateways/tap.gateway';
import { MoyasarGateway } from './gateways/moyasar.gateway';
import { TamaraGateway } from './gateways/tamara.gateway';
import { TabbyGateway } from './gateways/tabby.gateway';

// Processors
import { WebhookProcessor } from './processors/webhook.processor';

// Constants
import { PAYMENT_QUEUE_NAMES } from './constants';

// External modules
import { StorageModule } from '../storage/storage.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    StorageModule,
    EmailModule,
    // BullMQ queue for webhook processing (conditional on Redis)
    ...(process.env.REDIS_HOST
      ? [BullModule.registerQueue({ name: PAYMENT_QUEUE_NAMES.WEBHOOK_PROCESSING })]
      : []),
  ],
  controllers: [
    PaymentsController,
    WebhooksController,
    InvoicesController,
    RefundsController,
    DiscountsController,
    FinanceController,
  ],
  providers: [
    PaymentsService,
    InvoiceService,
    RefundService,
    DiscountService,
    FinanceService,
    GatewayFactory,
    MockGateway,
    TapGateway,
    MoyasarGateway,
    TamaraGateway,
    TabbyGateway,
    PaymentCleanupService,
    // Webhook processor only when Redis is available
    ...(process.env.REDIS_HOST ? [WebhookProcessor] : []),
  ],
  exports: [PaymentsService, InvoiceService],
})
export class PaymentsModule {}
