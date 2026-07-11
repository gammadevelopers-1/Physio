import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { and, eq, lt, or, sql } from 'drizzle-orm';
import { db } from '../../database';
import { xapiStatements, XAPI_STATEMENT_STATUS } from '../../database/schema';
import {
  XAPI_QUEUE_NAMES,
  XAPI_JOB_NAMES,
  type TransmitStatementJobData,
} from './constants';
import { JobHandler } from '../jobs/job-handler.interface';
import { JobRegistry } from '../jobs/job-registry.service';

/**
 * Cloud Run Job form of the hourly xAPI safety-net flush that used to
 * live as @Cron in XapiFlushCron. The @Cron method still exists but
 * short-circuits when EXTERNALIZED_CRONS contains 'xapi.flush'; on
 * that flip Cloud Scheduler → this Job → run() takes over.
 *
 * Logic is identical to the original (see XapiFlushCron.flush) — this
 * class is a thin adapter that binds the same code path to the
 * JobHandler contract main-job.ts expects.
 */
@Injectable()
export class XapiFlushJob implements JobHandler {
  readonly name = 'xapi.flush';
  private readonly logger = new Logger(XapiFlushJob.name);

  constructor(
    registry: JobRegistry,
    private readonly configService: ConfigService,
    @Optional()
    @InjectQueue(XAPI_QUEUE_NAMES.STATEMENTS)
    private readonly queue: Queue<TransmitStatementJobData> | null,
  ) {
    registry.register(this);
  }

  async run(): Promise<void> {
    const enabled = this.configService.get<boolean>('nelc.enabled');
    if (!enabled) {
      this.logger.log(
        '[xapi-flush] NELC disabled — skipping flush (this is expected in non-NELC deployments)',
      );
      return;
    }
    if (!this.queue) {
      this.logger.warn(
        '[xapi-flush] Redis not configured — cannot enqueue retries',
      );
      return;
    }

    const now = new Date();
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

    const candidates = await db
      .select({ id: xapiStatements.id, status: xapiStatements.status })
      .from(xapiStatements)
      .where(
        or(
          and(
            eq(xapiStatements.status, XAPI_STATEMENT_STATUS.PENDING),
            lt(xapiStatements.createdAt, tenMinAgo),
          ),
          and(
            eq(xapiStatements.status, XAPI_STATEMENT_STATUS.FAILED),
            lt(xapiStatements.createdAt, thirtyMinAgo),
          ),
        ),
      )
      .orderBy(sql`${xapiStatements.createdAt} ASC`)
      .limit(500);

    if (candidates.length === 0) {
      this.logger.debug('[xapi-flush] No statements to retry');
      return;
    }

    this.logger.log(
      `[xapi-flush] Re-enqueuing ${candidates.length} statements`,
    );
    for (const c of candidates) {
      // Flip failed → pending BEFORE enqueue so a second execution
      // within the same window doesn't schedule the same statement
      // twice. (Same dedup dance as the original @Cron.)
      if (c.status === XAPI_STATEMENT_STATUS.FAILED) {
        await db
          .update(xapiStatements)
          .set({ status: XAPI_STATEMENT_STATUS.PENDING })
          .where(eq(xapiStatements.id, c.id));
      }
      await this.queue.add(
        XAPI_JOB_NAMES.TRANSMIT_STATEMENT,
        { statementId: c.id },
        {
          attempts: 1,
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );
    }
  }
}
