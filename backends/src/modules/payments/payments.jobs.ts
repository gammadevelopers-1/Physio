import { Injectable } from '@nestjs/common';
import { JobHandler } from '../jobs/job-handler.interface';
import { JobRegistry } from '../jobs/job-registry.service';
import { TamaraRetryService } from './services/tamara-retry.service';
import { PaymentCleanupService } from './services/payment-cleanup.service';

/**
 * Cloud Run Jobs form of PaymentsModule's @Cron methods. Thin
 * delegators: the in-container @Cron guards on api-web short-circuit
 * via isCronExternalized(); Cloud Scheduler triggers these Jobs on the
 * same cadence and they call the same service methods. main-job.ts
 * clears EXTERNALIZED_CRONS before bootstrap so the kill switch never
 * fires inside a Job process.
 */
@Injectable()
export class TamaraRetryJob implements JobHandler {
  readonly name = 'payments.tamara-retry';

  constructor(
    registry: JobRegistry,
    private readonly service: TamaraRetryService,
  ) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.service.retryStuckOrders();
  }
}

@Injectable()
export class PaymentCleanupJob implements JobHandler {
  readonly name = 'payments.cleanup';

  constructor(
    registry: JobRegistry,
    private readonly service: PaymentCleanupService,
  ) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.service.cleanupStalePayments();
  }
}
