import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { db } from '../../database';
import {
  serviceStatusComponents,
  cronRuns,
} from '../../database/schema';
import { runCheck } from './service-status-checks';

const CRON_NAME = 'service_status_check';

@Injectable()
export class ServiceStatusCron {
  private readonly logger = new Logger(ServiceStatusCron.name);

  // Every 5 minutes — standard cadence for a status page. Anything
  // tighter eats Cloud Run minutes + bumps into Statuspage rate
  // limits; anything looser risks stale status during an incident.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron(): Promise<void> {
    await this.trackCronRun(CRON_NAME, async () => {
      const components = await db
        .select()
        .from(serviceStatusComponents)
        .where(
          and(
            eq(serviceStatusComponents.isActive, true),
            ne(serviceStatusComponents.checkType, 'manual'),
          ),
        );

      for (const c of components) {
        try {
          const result = await runCheck(c.checkType, c.checkConfig);
          if (!result) continue; // manual — shouldn't happen given the where above
          const now = new Date();

          if (result.error) {
            // Network/upstream failure — record the error but DO NOT
            // overwrite auto_status. We have no evidence that the
            // upstream component itself is degraded.
            await db
              .update(serviceStatusComponents)
              .set({
                autoCheckedAt: now,
                autoError: result.error.slice(0, 1000),
              })
              .where(eq(serviceStatusComponents.key, c.key));
            this.logger.warn(
              `[${c.key}] check error: ${result.error}`,
            );
            continue;
          }

          // Successful check — store the detected status. If there's
          // no manual override active, also propagate to currentStatus
          // so the existing public endpoint stays consistent.
          const updates: Record<string, unknown> = {
            autoStatus: result.status,
            autoCheckedAt: now,
            autoError: null,
          };
          if (!c.manualOverrideStatus) {
            updates.currentStatus = result.status;
            updates.updatedAt = now;
          }

          await db
            .update(serviceStatusComponents)
            .set(updates)
            .where(eq(serviceStatusComponents.key, c.key));
        } catch (err) {
          // Per-component failure shouldn't tank the whole loop —
          // log it and keep going so other components still get
          // checked this tick.
          this.logger.error(
            `[${c.key}] unexpected check failure: ${(err as Error).message}`,
          );
        }
      }
    });
  }

  // Same wrapper SlaMonitorService uses. Inserts a cron_runs row,
  // updates it on completion (success or error), keeps the
  // operational strip honest about whether the cron is actually
  // firing.
  private async trackCronRun(
    name: string,
    body: () => Promise<void>,
  ): Promise<void> {
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

// Suppress unused-import warning — isNull is here for symmetry with
// future check types that might filter on null configs.
void isNull;
