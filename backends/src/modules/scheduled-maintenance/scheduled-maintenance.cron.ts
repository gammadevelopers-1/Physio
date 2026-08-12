import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isCronExternalized } from '../../common/is-cron-externalized.helper';
import { eq } from 'drizzle-orm';
import { db } from '../../database';
import { cronRuns } from '../../database/schema';
import {
  MaintenanceTaskPayload,
  MAINTENANCE_HANDLERS,
  MAINTENANCE_QUEUE,
  ScheduledMaintenanceService,
} from './scheduled-maintenance.service';
import { TasksService } from '../tasks/tasks.service';
import { DistributedLockService } from '../tasks/distributed-lock.service';
import { SafetyNetSweep } from '../tasks/safety-net-sweep';

const CRON_NAME = 'scheduled_maintenance_tick';
const SAFETY_NET_CRON = 'scheduled_maintenance_safety_net';
// A missed lifecycle task is only "stale" once its scheduleTime is more
// than 15 min in the past — earlier than that and Cloud Tasks retry
// backoff might still get to it. 15 min is well above the queue's
// max-backoff for maintenance-events (1800s = 30min actually; picking
// 30min-ish threshold keeps us clear of normal retries).
const STALE_LAG_MS = 30 * 60_000;

/**
 * Runs every minute. Three responsibilities:
 *
 *  1. Activate any scheduled window whose start_at has passed —
 *     flips the system maintenance toggle ON.
 *  2. Complete any active window whose end_at has passed — flips
 *     the toggle OFF (only if this window was the one that flipped
 *     it on, to play nice with manual overrides).
 *  3. Fire pre-notifications for windows entering their lead window.
 *
 * Every-minute is fine: each tick is two short SELECTs + at most a
 * couple of writes. Cron-runs row keeps the operational view honest.
 */
@Injectable()
export class ScheduledMaintenanceCron {
  private readonly logger = new Logger(ScheduledMaintenanceCron.name);
  private readonly safetyNet: SafetyNetSweep;

  constructor(
    private readonly service: ScheduledMaintenanceService,
    tasks: TasksService,
    lock: DistributedLockService,
  ) {
    this.safetyNet = new SafetyNetSweep(tasks, lock);
  }

  /**
   * Legacy per-minute tick — LEFT IN PLACE during the Cloud Tasks
   * parallel-run so a queue misconfig can't blackhole activations.
   * The per-row service methods use CAS UPDATEs; whichever path (this
   * cron OR the Cloud Task delivery) wins the CAS acts, the other
   * no-ops. Safe to retire after 30 days of Cloud Tasks stability.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (isCronExternalized('scheduled-maintenance.tick')) return;
    await this.tracked(CRON_NAME, async () => {
      const activated = await this.service.tickActivations();
      const completed = await this.service.tickCompletions();
      const notified = await this.service.tickPreNotifications();
      if (activated || completed || notified) {
        this.logger.log(
          `Tick: ${activated} activated · ${completed} completed · ${notified} notified`,
        );
      }
    });
  }

  /**
   * Hourly safety-net for the event-driven pipeline. Looks for
   * windows whose lifecycle task should have fired more than 30 min
   * ago and re-enqueues them (which the handlers process immediately
   * because scheduleAt is omitted). Alerts if it finds >5 stale rows
   * in any single run — that's the signal the primary enqueue path
   * has regressed.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async safetyNetSweep(): Promise<void> {
    // Same externalization slug intentionally — one env-var kills both
    // paths for this domain when needed.
    if (isCronExternalized('scheduled-maintenance.safety-net')) return;

    await this.tracked(SAFETY_NET_CRON, async () => {
      const [activateResult, completeResult, preNotifyResult] = await Promise.all([
        this.safetyNet.run<{ id: string }, MaintenanceTaskPayload>({
          slug: 'maintenance.activate',
          queue: MAINTENANCE_QUEUE,
          handler: MAINTENANCE_HANDLERS.ACTIVATE,
          alertThreshold: 5,
          findStale: () => this.service.findStaleForActivate(STALE_LAG_MS),
          taskParams: (row) => ({
            name: { entity: 'maint', id: row.id, event: 'activate', version: Date.now() },
            payload: { windowId: row.id },
          }),
        }),
        this.safetyNet.run<{ id: string }, MaintenanceTaskPayload>({
          slug: 'maintenance.complete',
          queue: MAINTENANCE_QUEUE,
          handler: MAINTENANCE_HANDLERS.COMPLETE,
          alertThreshold: 5,
          findStale: () => this.service.findStaleForComplete(STALE_LAG_MS),
          taskParams: (row) => ({
            name: { entity: 'maint', id: row.id, event: 'complete', version: Date.now() },
            payload: { windowId: row.id },
          }),
        }),
        this.safetyNet.run<{ id: string }, MaintenanceTaskPayload>({
          slug: 'maintenance.pre-notify',
          queue: MAINTENANCE_QUEUE,
          handler: MAINTENANCE_HANDLERS.PRE_NOTIFY,
          alertThreshold: 5,
          findStale: () => this.service.findStaleForPreNotify(STALE_LAG_MS),
          taskParams: (row) => ({
            name: { entity: 'maint', id: row.id, event: 'pre-notify', version: Date.now() },
            payload: { windowId: row.id },
          }),
        }),
      ]);

      const total = activateResult.reenqueued + completeResult.reenqueued + preNotifyResult.reenqueued;
      if (total > 0) {
        this.logger.warn(
          `Safety-net re-enqueued ${total} maintenance tasks (activate=${activateResult.reenqueued}, complete=${completeResult.reenqueued}, pre-notify=${preNotifyResult.reenqueued})`,
        );
      }
    });
  }

  private async tracked(name: string, body: () => Promise<void>): Promise<void> {
    let runId: string | null = null;
    const startedAt = new Date();
    try {
      const [row] = await db
        .insert(cronRuns)
        .values({ cronName: name, startedAt, status: 'running' })
        .returning({ id: cronRuns.id });
      runId = row?.id ?? null;
    } catch {
      // Tracking row failed — proceed without it.
    }

    try {
      await body();
      if (runId) {
        const finishedAt = new Date();
        await db
          .update(cronRuns)
          .set({
            status: 'success',
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
          })
          .where(eq(cronRuns.id, runId));
      }
    } catch (err) {
      if (runId) {
        const finishedAt = new Date();
        await db
          .update(cronRuns)
          .set({
            status: 'error',
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            errorMessage: String(err).slice(0, 500),
          })
          .where(eq(cronRuns.id, runId));
      }
      this.logger.error(`Cron ${name} failed: ${(err as Error).message}`);
    }
  }
}
