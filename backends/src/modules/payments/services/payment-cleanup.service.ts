import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isCronExternalized } from '../../../common/is-cron-externalized.helper';
import { eq, and, lt, ne, or, isNull } from 'drizzle-orm';
import { db } from '../../../database';
import {
  payments,
  enrollments,
  PAYMENT_STATUS,
  ENROLLMENT_STATUS,
} from '../../../database/schema';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { TasksService } from '../../tasks/tasks.service';
import { DistributedLockService } from '../../tasks/distributed-lock.service';
import { SafetyNetSweep } from '../../tasks/safety-net-sweep';

// Cloud Tasks constants for payments lifecycle
export const PAYMENTS_QUEUE = 'payment-events';
export const PAYMENT_HANDLERS = {
  CLEANUP: 'payment.cleanup',
} as const;

export interface PaymentTaskPayload {
  paymentId: string;
}

// Pending payment ages out at PAYMENT_STALE_AFTER_MS since createdAt.
export const PAYMENT_STALE_AFTER_MS = 2 * 60 * 60 * 1000; // 2h

@Injectable()
export class PaymentCleanupService {
  private readonly logger = new Logger(PaymentCleanupService.name);
  private readonly safetyNet: SafetyNetSweep;

  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly tasks: TasksService,
    private readonly lock: DistributedLockService,
  ) {
    this.safetyNet = new SafetyNetSweep(this.tasks, this.lock);
  }

  /**
   * Legacy every-30-min cron — RETAINED for parallel-run with Cloud
   * Tasks. Delegates to cleanupOne per row so both this and the
   * event-driven path share CAS-safe code. Retire in Phase 5.2.
   */
  @Cron('0 */30 * * * *')
  async cleanupStalePayments() {
    if (isCronExternalized('payments.cleanup')) return;
    const twoHoursAgo = new Date(Date.now() - PAYMENT_STALE_AFTER_MS);

    try {
      const stalePayments = await db
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.status, PAYMENT_STATUS.PENDING),
            lt(payments.createdAt, twoHoursAgo),
            or(
              ne(payments.gateway, 'tamara'),
              isNull(payments.gatewayChargeId),
            ),
          ),
        )
        .limit(100);

      if (stalePayments.length === 0) return;
      let expired = 0;
      for (const p of stalePayments) {
        if (await this.cleanupOne(p.id)) expired++;
      }
      if (expired > 0) {
        this.logger.log(`Expired ${expired} stale payment(s)`);
      }
    } catch (error) {
      this.logger.error(`Stale payment cleanup failed: ${(error as Error).message}`);
    }
  }

  // ─── Per-row event handler (Cloud Tasks entry point) ────

  /**
   * Expire one stale payment. CAS-safe:
   *   - status transition PENDING → FAILED requires status='pending'
   *   - Tamara-with-gatewayChargeId is skipped (TamaraRetryService owns
   *     that lifecycle for up to 60h)
   *   - Grace check on age prevents early fire
   */
  async cleanupOne(paymentId: string): Promise<boolean> {
    const [payment] = await db
      .select({
        id: payments.id,
        enrollmentId: payments.enrollmentId,
        gateway: payments.gateway,
        gatewayChargeId: payments.gatewayChargeId,
        status: payments.status,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.id, paymentId));

    if (!payment) return false;
    if (payment.status !== PAYMENT_STATUS.PENDING) return false;
    // Guard: task fired too early
    if (payment.createdAt.getTime() + PAYMENT_STALE_AFTER_MS > Date.now()) {
      return false;
    }
    // Skip Tamara payments that reached the gateway — retry service owns them.
    if (payment.gateway === 'tamara' && payment.gatewayChargeId) return false;

    const claim = await db
      .update(payments)
      .set({
        status: PAYMENT_STATUS.FAILED,
        failedAt: new Date(),
        failureReason: 'Payment expired - checkout not completed',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(payments.id, paymentId),
          eq(payments.status, PAYMENT_STATUS.PENDING),
        ),
      )
      .returning({ id: payments.id });
    if (claim.length === 0) return false;

    if (payment.enrollmentId) {
      await db
        .update(enrollments)
        .set({ status: ENROLLMENT_STATUS.DROPPED })
        .where(eq(enrollments.id, payment.enrollmentId));
    }

    await this.auditLogService
      .log({
        entityType: 'payment',
        entityId: payment.id,
        action: 'payment_expired',
        performedBy: 'system',
        metadata: {
          reason: 'Checkout not completed within 2 hours',
          enrollmentId: payment.enrollmentId,
        },
      })
      .catch(() => {});

    this.logger.log(`Expired stale payment ${payment.id}`);
    return true;
  }

  // ─── Cloud Tasks enqueue helpers ────────────────────────

  async enqueueCleanupTask(payment: {
    id: string;
    createdAt: Date;
  }): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    try {
      const fireAt = new Date(payment.createdAt.getTime() + PAYMENT_STALE_AFTER_MS);
      await this.tasks.enqueue<PaymentTaskPayload>({
        queue: PAYMENTS_QUEUE,
        handler: PAYMENT_HANDLERS.CLEANUP,
        name: {
          entity: 'payment',
          id: payment.id,
          event: 'cleanup',
          version: payment.createdAt,
        },
        payload: { paymentId: payment.id },
        scheduleAt: fireAt.getTime() < Date.now() ? undefined : fireAt,
      });
    } catch (e) {
      this.logger.error(
        `Failed to enqueue cleanup task for payment ${payment.id}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
    }
  }

  async cancelCleanupTask(paymentId: string): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    try {
      await this.tasks.cancelByEvent({
        queue: PAYMENTS_QUEUE,
        entity: 'payment',
        id: paymentId,
        event: 'cleanup',
      });
    } catch (e) {
      this.logger.warn(
        `Failed to cancel cleanup task for payment ${paymentId}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
    }
  }

  async findStaleForCleanup(lagMs: number): Promise<{ id: string }[]> {
    const cutoff = new Date(Date.now() - PAYMENT_STALE_AFTER_MS - lagMs);
    return db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.status, PAYMENT_STATUS.PENDING),
          lt(payments.createdAt, cutoff),
          or(
            ne(payments.gateway, 'tamara'),
            isNull(payments.gatewayChargeId),
          ),
        ),
      )
      .limit(100);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupSafetyNetSweep(): Promise<void> {
    if (isCronExternalized('payments.cleanup.safety-net')) return;
    await this.safetyNet.run<{ id: string }, PaymentTaskPayload>({
      slug: 'payments.cleanup',
      queue: PAYMENTS_QUEUE,
      handler: PAYMENT_HANDLERS.CLEANUP,
      alertThreshold: 5,
      findStale: () => this.findStaleForCleanup(60 * 60_000), // 1h lag past staleAfter
      taskParams: (row) => ({
        name: {
          entity: 'payment',
          id: row.id,
          event: 'cleanup',
          version: Date.now(),
        },
        payload: { paymentId: row.id },
      }),
    });
  }
}
