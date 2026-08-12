import { Logger } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { DistributedLockService } from './distributed-lock.service';
import { TaskNameParts } from './task-name';

/**
 * Every Category-A cron migration follows the same shape:
 *
 *   PRIMARY   Enqueue Cloud Task on row INSERT/UPDATE at trigger time.
 *   BACKUP    Periodically scan for rows whose trigger time is past
 *             and whose downstream side-effect column is still null;
 *             re-enqueue them.
 *
 * The backup pass exists because the primary can silently fail: a
 * queue misconfig, a Cloud Tasks purge accident, a code deploy that
 * skips the enqueue path, or a bug that raises before enqueue commits.
 * Without a sweep behind it, those failures become silent data
 * corruption (a session that never gets a reminder, a payment that
 * stays PENDING forever).
 *
 * This runner encapsulates the shape so each migration only has to
 * supply:
 *   - A slug (for locking, logging, metrics)
 *   - The queue + handler for re-enqueue
 *   - A `findStale()` that returns rows needing a task
 *   - A `taskParams(row)` that builds the task name + payload
 *
 * Locking: sweeps run in-process on api-web. We take a distributed
 * lock keyed by the sweep slug to prevent multi-instance duplicate
 * scans. TTL slightly > expected sweep runtime.
 *
 * Alerting: if `staleCount > alertThreshold`, we log an ERROR. In
 * production this feeds Cloud Logging → alert policy. The threshold
 * is per-sweep because normal churn varies (session sweep might see
 * 5 stale rows on a busy hour; payment sweep should never see any).
 */

export interface SafetyNetSweepConfig<TRow, TPayload> {
  /** Unique slug — used for lock key, log prefix, metrics label */
  slug: string;
  /** Cloud Tasks queue to enqueue into */
  queue: string;
  /** Handler slug to invoke */
  handler: string;
  /** Lock TTL for this sweep — must exceed expected runtime */
  lockTtlMs?: number;
  /** Alert if a single sweep finds more than this many stale rows */
  alertThreshold?: number;
  /** Returns rows whose primary enqueue appears to have been missed */
  findStale(): Promise<TRow[]>;
  /** Builds the task name + payload for a stale row (fires immediately) */
  taskParams(row: TRow): { name: TaskNameParts; payload: TPayload };
}

export class SafetyNetSweep {
  private readonly logger: Logger;

  constructor(
    private readonly tasks: TasksService,
    private readonly lock: DistributedLockService,
  ) {
    this.logger = new Logger('SafetyNetSweep');
  }

  async run<TRow, TPayload>(
    config: SafetyNetSweepConfig<TRow, TPayload>,
  ): Promise<{ scanned: number; reenqueued: number }> {
    const lockKey = `lock:safety-net:${config.slug}`;
    const ttl = config.lockTtlMs ?? 60_000;
    const alertThreshold = config.alertThreshold ?? 10;

    const outcome = await this.lock.withLock(lockKey, ttl, async () => {
      const startedAt = Date.now();
      const stale = await config.findStale();
      let reenqueued = 0;

      if (stale.length > alertThreshold) {
        this.logger.error(
          `[${config.slug}] safety-net found ${stale.length} stale rows (threshold ${alertThreshold}) — primary enqueue path may be broken`,
        );
      } else if (stale.length > 0) {
        this.logger.warn(
          `[${config.slug}] safety-net re-enqueueing ${stale.length} stale row(s)`,
        );
      }

      for (const row of stale) {
        const { name, payload } = config.taskParams(row);
        try {
          await this.tasks.enqueue({
            queue: config.queue,
            handler: config.handler,
            name,
            payload,
            // Fire immediately — the trigger time has already passed.
          });
          reenqueued++;
        } catch (err: unknown) {
          const errorObj = err as { message?: string };
          this.logger.error(
            `[${config.slug}] re-enqueue failed for ${name.entity}:${name.id}: ${errorObj.message}`,
          );
        }
      }

      const elapsedMs = Date.now() - startedAt;
      this.logger.log(
        `[${config.slug}] safety-net swept ${stale.length} stale, re-enqueued ${reenqueued} in ${elapsedMs}ms`,
      );

      return { scanned: stale.length, reenqueued };
    });

    // If withLock returned null another instance is already running the
    // sweep; we treat that as a successful no-op.
    return outcome ?? { scanned: 0, reenqueued: 0 };
  }
}
