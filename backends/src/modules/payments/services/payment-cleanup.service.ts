import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { isCronExternalized } from '../../../common/is-cron-externalized.helper';
import { eq, and, lt, ne, or, isNull, sql } from 'drizzle-orm';
import { db } from '../../../database';
import {
  payments,
  enrollments,
  PAYMENT_STATUS,
  ENROLLMENT_STATUS,
} from '../../../database/schema';
import { AuditLogService } from '../../audit-logs/audit-logs.service';

@Injectable()
export class PaymentCleanupService {
  private readonly logger = new Logger(PaymentCleanupService.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * Expire stale pending payments every 30 minutes.
   * Payments that have been pending for more than 2 hours are considered abandoned.
   */
  @Cron('0 */30 * * * *')
  async cleanupStalePayments() {
    if (isCronExternalized('payments.cleanup')) return;
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    try {
      // Skip Tamara payments where the buyer reached the gateway
      // (gatewayChargeId is set) — TamaraRetryService owns their lifecycle
      // for up to 60 hours while we authorise+capture asynchronously.
      // Expiring them prematurely here would mark them as failed before
      // the retry queue gets a chance, and Tamara would still refund the
      // buyer at 72h — leaving us with a payment row that says 'failed'
      // and a Tamara order that says 'expired' for the same reason.
      const stalePayments = await db
        .select({
          id: payments.id,
          enrollmentId: payments.enrollmentId,
          gateway: payments.gateway,
        })
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

      this.logger.log(
        `Payment cleanup: processing ${stalePayments.length} stale payment(s) (batch limit: 100)`,
      );

      for (const stalePayment of stalePayments) {
        try {
          // Mark payment as failed
          await db
            .update(payments)
            .set({
              status: PAYMENT_STATUS.FAILED,
              failedAt: new Date(),
              failureReason: 'Payment expired - checkout not completed',
              updatedAt: new Date(),
            })
            .where(eq(payments.id, stalePayment.id));

          // Cancel the pending enrollment
          if (stalePayment.enrollmentId) {
            await db
              .update(enrollments)
              .set({
                status: ENROLLMENT_STATUS.DROPPED,
              })
              .where(eq(enrollments.id, stalePayment.enrollmentId));
          }

          await this.auditLogService.log({
            entityType: 'payment',
            entityId: stalePayment.id,
            action: 'payment_expired',
            performedBy: 'system',
            metadata: {
              reason: 'Checkout not completed within 2 hours',
              enrollmentId: stalePayment.enrollmentId,
            },
          });

          this.logger.log(`Expired stale payment ${stalePayment.id}`);
        } catch (err) {
          this.logger.error(
            `Failed to expire payment ${stalePayment.id}: ${err.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Stale payment cleanup failed: ${error.message}`);
    }
  }
}
