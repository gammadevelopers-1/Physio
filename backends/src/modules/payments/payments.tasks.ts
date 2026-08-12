import { Injectable } from '@nestjs/common';
import { TaskHandler } from '../tasks/task-handler.interface';
import { TaskHandlerRegistry } from '../tasks/task-handler.registry';
import {
  PaymentCleanupService,
  PAYMENT_HANDLERS,
  PaymentTaskPayload,
} from './services/payment-cleanup.service';

/**
 * Cloud Tasks entry point for payment lifecycle events.
 *
 * payment.cleanup — fires at payment.createdAt + 2h. Delegates to
 * PaymentCleanupService.cleanupOne which CAS-flips PENDING → FAILED
 * and cancels the linked enrollment. Skips Tamara payments that have
 * reached the gateway (TamaraRetryService owns that lifecycle up to 60h).
 */
@Injectable()
export class PaymentCleanupTask implements TaskHandler<PaymentTaskPayload> {
  readonly name = PAYMENT_HANDLERS.CLEANUP;

  constructor(
    registry: TaskHandlerRegistry,
    private readonly cleanup: PaymentCleanupService,
  ) {
    registry.register(this);
  }

  async run({ payload }: { payload: PaymentTaskPayload }): Promise<void> {
    await this.cleanup.cleanupOne(payload.paymentId);
  }
}
