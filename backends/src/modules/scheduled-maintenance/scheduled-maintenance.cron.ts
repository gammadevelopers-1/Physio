import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq } from 'drizzle-orm';
import { db } from '../../database';
import { cronRuns } from '../../database/schema';
import { ScheduledMaintenanceService } from './scheduled-maintenance.service';

const CRON_NAME = 'scheduled_maintenance_tick';

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

  constructor(private readonly service: ScheduledMaintenanceService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
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
