import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '../../database';
import { pointRedemptions, pointTransactions } from '../../database/schema';

/**
 * PointsCronService — periodic maintenance for the points system.
 *
 * Two responsibilities:
 *
 * 1. **sweepStaleRedemptionHolds** (every 5 minutes)
 *    Finds pending redemptions whose `expires_at` is in the past — these
 *    are abandoned checkout flows where points were debited but the
 *    enrollment never committed. Inserts a compensating credit so the
 *    user gets their points back, and flips the redemption to 'released'.
 *
 * 2. **logExpiredEarnings** (daily)
 *    The balance query already filters expired ledger rows out of `getBalance`
 *    automatically. This cron is purely for *visibility* — it inserts a
 *    `system:expire` zero-delta marker per expired earn the previous day so
 *    students see "100 pts expired" in their history rather than a silent
 *    drop in balance. (Zero-delta = doesn't double-affect balance — the row
 *    is just a tombstone.)
 */
@Injectable()
export class PointsCronService {
  private readonly logger = new Logger(PointsCronService.name);

  /**
   * Release expired redemption holds. Runs every 5 minutes — a 30-minute
   * hold expires within at most 35 minutes of being abandoned.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepStaleRedemptionHolds(): Promise<void> {
    const now = new Date();

    const stale = await db
      .select({
        id: pointRedemptions.id,
        userId: pointRedemptions.userId,
        pointsUsed: pointRedemptions.pointsUsed,
      })
      .from(pointRedemptions)
      .where(
        and(
          eq(pointRedemptions.status, 'pending'),
          lt(pointRedemptions.expiresAt, now),
        ),
      );

    if (stale.length === 0) return;

    this.logger.log(`Releasing ${stale.length} stale redemption hold(s)`);

    for (const redemption of stale) {
      try {
        // Compensating credit — idempotent via unique key, so a retry of the
        // same sweep won't duplicate.
        await db
          .insert(pointTransactions)
          .values({
            userId: redemption.userId,
            delta: redemption.pointsUsed,
            reason: 'redeem:released',
            sourceEntityType: 'redemption',
            sourceEntityId: redemption.id,
            idempotencyKey: `redeem_released:${redemption.id}`,
          })
          .onConflictDoNothing();

        await db
          .update(pointRedemptions)
          .set({ status: 'released', releasedAt: now })
          .where(eq(pointRedemptions.id, redemption.id));
      } catch (err) {
        this.logger.error(
          `Failed to release redemption ${redemption.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Insert a zero-delta `system:expire` tombstone for each ledger row that
   * crossed its expires_at in the last 24 hours. This makes expirations
   * visible in the user's transaction history without changing their
   * balance (which the read query already handles).
   *
   * Idempotency key: `expire:{ledger_row_id}` — re-runs are safe.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async logExpiredEarnings(): Promise<void> {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();

    // Find earn rows that expired in the last day. Using a simple WHERE on
    // expires_at — this picks up all newly-crossed expirations regardless
    // of when the cron previously ran (idempotency keys protect against dup).
    const expiredRows = await db
      .select({
        id: pointTransactions.id,
        userId: pointTransactions.userId,
        delta: pointTransactions.delta,
      })
      .from(pointTransactions)
      .where(
        and(
          sql`${pointTransactions.expiresAt} > ${yesterday}`,
          sql`${pointTransactions.expiresAt} <= ${now}`,
          sql`${pointTransactions.delta} > 0`,
          sql`${pointTransactions.reason} LIKE 'earn:%'`,
        ),
      );

    if (expiredRows.length === 0) return;

    this.logger.log(`Logging ${expiredRows.length} expired earning(s)`);

    for (const row of expiredRows) {
      try {
        // Zero delta — purely a history marker. Balance is unaffected
        // (the original row already dropped from balance via the
        // expires_at filter on getBalance).
        await db
          .insert(pointTransactions)
          .values({
            userId: row.userId,
            delta: 0,
            reason: 'system:expire',
            sourceEntityType: 'point_transaction',
            sourceEntityId: row.id,
            idempotencyKey: `expire:${row.id}`,
            metadata: { expiredAmount: row.delta } as never,
          })
          .onConflictDoNothing();
      } catch (err) {
        this.logger.error(
          `Failed to log expiration for ${row.id}: ${(err as Error).message}`,
        );
      }
    }
  }
}
