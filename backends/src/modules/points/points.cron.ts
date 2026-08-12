import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isCronExternalized } from '../../common/is-cron-externalized.helper';
import { and, eq, lt, sql } from 'drizzle-orm';
import { db } from '../../database';
import { pointRedemptions, pointTransactions } from '../../database/schema';
import { TasksService } from '../tasks/tasks.service';
import { DistributedLockService } from '../tasks/distributed-lock.service';
import { SafetyNetSweep } from '../tasks/safety-net-sweep';

// Cloud Tasks constants — kept adjacent so name-scheme and handler
// wiring don't drift.
export const POINTS_QUEUE = 'points-events';
export const POINTS_HANDLERS = {
  RELEASE_HOLD: 'points.release-hold',
} as const;

export interface PointsTaskPayload {
  redemptionId: string;
}

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
  private readonly safetyNet: SafetyNetSweep;

  constructor(
    private readonly tasks: TasksService,
    private readonly lock: DistributedLockService,
  ) {
    this.safetyNet = new SafetyNetSweep(this.tasks, this.lock);
  }

  /**
   * Legacy every-5-minute sweep — RETAINED for parallel-run with Cloud
   * Tasks. Delegates to releaseHoldOne per row so both this and the
   * event-driven path hit the same CAS-safe code.
   *
   * Retire in Phase 5.2 once the primary task pipeline has been stable.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepStaleRedemptionHolds(): Promise<void> {
    if (isCronExternalized('points.sweep-holds')) return;
    const now = new Date();

    const stale = await db
      .select({ id: pointRedemptions.id })
      .from(pointRedemptions)
      .where(
        and(
          eq(pointRedemptions.status, 'pending'),
          lt(pointRedemptions.expiresAt, now),
        ),
      );

    if (stale.length === 0) return;
    let released = 0;
    for (const r of stale) {
      if (await this.releaseHoldOne(r.id)) released++;
    }
    if (released > 0) {
      this.logger.log(`Released ${released} stale redemption hold(s)`);
    }
  }

  // ─── Per-row event handler (Cloud Tasks entry point) ─────

  /**
   * Release one stale redemption hold. Idempotent under any interleaving:
   *   - Compensating credit uses idempotencyKey `redeem_released:{id}`;
   *     a second insert onConflictDoNothing is a no-op.
   *   - Status transition is CAS-guarded (status='pending' clause);
   *     concurrent callers see rowCount=0 and skip.
   *
   * Also guards on expiresAt so a task firing early doesn't release a
   * still-live hold.
   */
  async releaseHoldOne(redemptionId: string): Promise<boolean> {
    const [redemption] = await db
      .select({
        id: pointRedemptions.id,
        userId: pointRedemptions.userId,
        pointsUsed: pointRedemptions.pointsUsed,
        status: pointRedemptions.status,
        expiresAt: pointRedemptions.expiresAt,
      })
      .from(pointRedemptions)
      .where(eq(pointRedemptions.id, redemptionId));

    if (!redemption) return false;
    if (redemption.status !== 'pending') return false;
    if (redemption.expiresAt.getTime() > Date.now()) return false;

    // CAS FIRST. If the redemption got committed to 'applied' between
    // our SELECT and here, this UPDATE affects 0 rows and we bail out
    // WITHOUT inserting the compensating credit. Correctness > cleanup:
    // no double-credit possible.
    const claim = await db
      .update(pointRedemptions)
      .set({ status: 'released', releasedAt: new Date() })
      .where(
        and(
          eq(pointRedemptions.id, redemptionId),
          eq(pointRedemptions.status, 'pending'),
        ),
      )
      .returning({ id: pointRedemptions.id });

    if (claim.length === 0) return false;

    // Credit only after we own the status transition. Idempotency key
    // means a retry of the same task (Cloud Tasks retry after 5xx)
    // still runs correctly — the second insert is onConflictDoNothing.
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

    return true;
  }

  // ─── Cloud Tasks enqueue/cancel helpers ───────────────────

  async enqueueReleaseHoldTask(redemption: {
    id: string;
    expiresAt: Date;
  }): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    try {
      await this.tasks.enqueue<PointsTaskPayload>({
        queue: POINTS_QUEUE,
        handler: POINTS_HANDLERS.RELEASE_HOLD,
        name: {
          entity: 'redemption',
          id: redemption.id,
          event: 'release-hold',
          version: redemption.expiresAt,
        },
        payload: { redemptionId: redemption.id },
        scheduleAt:
          redemption.expiresAt.getTime() < Date.now()
            ? undefined
            : redemption.expiresAt,
      });
    } catch (e) {
      this.logger.error(
        `Failed to enqueue release-hold task for redemption ${redemption.id}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
    }
  }

  async cancelReleaseHoldTask(redemptionId: string): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    try {
      await this.tasks.cancelByEvent({
        queue: POINTS_QUEUE,
        entity: 'redemption',
        id: redemptionId,
        event: 'release-hold',
      });
    } catch (e) {
      this.logger.warn(
        `Failed to cancel release-hold task for redemption ${redemptionId}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
    }
  }

  async findStaleForReleaseHold(lagMs: number): Promise<{ id: string }[]> {
    const cutoff = new Date(Date.now() - lagMs);
    return db
      .select({ id: pointRedemptions.id })
      .from(pointRedemptions)
      .where(
        and(
          eq(pointRedemptions.status, 'pending'),
          lt(pointRedemptions.expiresAt, cutoff),
        ),
      );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async releaseHoldSafetyNetSweep(): Promise<void> {
    if (isCronExternalized('points.sweep-holds.safety-net')) return;
    await this.safetyNet.run<{ id: string }, PointsTaskPayload>({
      slug: 'points.sweep-holds',
      queue: POINTS_QUEUE,
      handler: POINTS_HANDLERS.RELEASE_HOLD,
      alertThreshold: 5,
      // Redemptions expire ~30 min after creation; give the event-
      // driven path 20 min beyond that before treating as stale.
      findStale: () => this.findStaleForReleaseHold(20 * 60_000),
      taskParams: (row) => ({
        name: {
          entity: 'redemption',
          id: row.id,
          event: 'release-hold',
          version: Date.now(),
        },
        payload: { redemptionId: row.id },
      }),
    });
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
    if (isCronExternalized('points.log-expired')) return;
    // Distributed lock prevents multi-instance api-web from double-
    // inserting expiry tombstones when this cron moves fully in-process
    // (Phase 4). The `expire:{row.id}` idempotency key would already
    // absorb the duplicate insert, but skipping the redundant work
    // saves DB round-trips. 5-min TTL comfortably exceeds observed run
    // time (typically <5s on modest volumes).
    const outcome = await this.lock.withLock(
      'lock:cron:points.log-expired',
      5 * 60_000,
      () => this.logExpiredEarningsInner(),
    );
    if (outcome === null) {
      // Another instance held the lock; safe no-op.
    }
  }

  private async logExpiredEarningsInner(): Promise<void> {
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
