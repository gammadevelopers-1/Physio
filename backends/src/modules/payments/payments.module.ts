import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

// Controllers
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { InvoicesController } from './invoices/invoices.controller';
import { RefundsController } from './refunds/refunds.controller';
import { DiscountsController } from './discounts/discounts.controller';
import { FinanceController } from './finance/finance.controller';
import { FinanceSettingsController } from './finance/finance-settings.controller';
import { PublicTaxController } from './finance/public-tax.controller';
import { BankTransferController } from './bank-transfer/bank-transfer.controller';
import { ReconciliationController } from './reconciliation/reconciliation.controller';
import { EscalationsController } from './reconciliation/escalations.controller';
import { ReconciliationCronController } from './reconciliation/reconciliation-cron.controller';
import { AdminFinanceController } from './admin/admin-finance.controller';
import { StudentFinanceController } from './student/student-finance.controller';

// Services
import { PaymentsService } from './payments.service';
import { InvoiceService } from './services/invoice.service';
import { RefundService } from './services/refund.service';
import { RefundPolicyService } from './services/refund-policy.service';
import { TaxComputationService } from './services/tax-computation.service';
import { DiscountService } from './services/discount.service';
import { FinanceService } from './services/finance.service';
import { PaymentCleanupService } from './services/payment-cleanup.service';
import { TamaraRetryService } from './services/tamara-retry.service';
import { PaymentAdminNotifierService } from './services/payment-admin-notifier.service';
import { BankTransferService } from './bank-transfer/bank-transfer.service';
import { ReconciliationService } from './reconciliation/reconciliation.service';
import { EscalationsService } from './reconciliation/escalations.service';
import { ReconciliationCronService } from './reconciliation/reconciliation-cron.service';

// Gateways
import { GatewayFactory } from './gateways/gateway.factory';
import { MockGateway } from './gateways/mock.gateway';
import { MoyasarGateway } from './gateways/moyasar.gateway';
import { TamaraGateway } from './gateways/tamara.gateway';
import { TabbyGateway } from './gateways/tabby.gateway';
import { BankTransferGateway } from './gateways/bank-transfer.gateway';

// Processors
import { WebhookProcessor } from './processors/webhook.processor';

// Cloud Run Job wrappers
import { TamaraRetryJob, PaymentCleanupJob } from './payments.jobs';

// Constants
import { PAYMENT_QUEUE_NAMES } from './constants';

// External modules
import { StorageModule } from '../storage/storage.module';
import { EmailModule } from '../email/email.module';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { ZoomModule } from '../zoom/zoom.module';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { GatewayCredentialsService } from './gateways/gateway-credentials.service';

@Module({
  imports: [
    StorageModule,
    EmailModule,
    SiteSettingsModule,
    EnrollmentsModule,
    ZoomModule,
    AdminSettingsModule,
    UserNotificationsModule,
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
    FinanceSettingsController,
    PublicTaxController,
    BankTransferController,
    ReconciliationController,
    EscalationsController,
    ReconciliationCronController,
    AdminFinanceController,
    StudentFinanceController,
  ],
  providers: [
    PaymentsService,
    InvoiceService,
    RefundService,
    RefundPolicyService,
    TaxComputationService,
    DiscountService,
    FinanceService,
    BankTransferService,
    ReconciliationService,
    EscalationsService,
    ReconciliationCronService,
    GatewayFactory,
    GatewayCredentialsService,
    MockGateway,
    MoyasarGateway,
    TamaraGateway,
    TabbyGateway,
    BankTransferGateway,
    PaymentCleanupService,
    TamaraRetryService,
    PaymentAdminNotifierService,
    // Cloud Run Job wrappers — self-register with JobRegistry
    TamaraRetryJob,
    PaymentCleanupJob,
    // Webhook processor only when Redis is available AND this container
    // is running as a BullMQ worker. When SKIP_BULLMQ_WORKERS=true (set
    // on the HTTP-serving api-web service after the worker split), the
    // processor class is NOT registered — no BullMQ Worker is created
    // for this queue, so this container won't consume jobs. Queue
    // producers (WebhooksController's @InjectQueue) still work because
    // BullModule.registerQueue is unaffected by this gate.
    ...(process.env.REDIS_HOST && process.env.SKIP_BULLMQ_WORKERS !== 'true'
      ? [WebhookProcessor]
      : []),
  ],
  exports: [
    PaymentsService,
    InvoiceService,
    GatewayCredentialsService,
    // Exported so CoursesService.cancelCourse can issue refunds through the
    // same state machine + gateway integrations as the admin refund UI.
    RefundService,
    // Exported so CoursesService can tag catalog courses with any active
    // campaign auto-apply discount (public /courses list + course detail).
    DiscountService,
  ],
})
export class PaymentsModule {}
