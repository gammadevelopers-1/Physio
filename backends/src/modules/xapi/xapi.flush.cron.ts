import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
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
import { isCronExternalized } from '../../common/is-cron-externalized.helper';

/**
 * Hourly safety-net flush. Picks up:
 *   1. Statements stuck in `pending` for > 10 minutes (queue lost the
 *      job, e.g. Redis restart between insert and enqueue).
 *   2. Statements in `failed` status that have been there > 30 minutes
 *      (cooldown before automatic retry — manual retry from the admin
 *      UI doesn't wait for this).
 *
 * Caps each tick at 500 statements so a backlog can't monopolise the
 * queue. Subsequent ticks drain the rest.
 */
@Injectable()
export class XapiFlushCron {
  private readonly logger = new Logger(XapiFlushCron.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @InjectQueue(XAPI_QUEUE_NAMES.STATEMENTS)
    private readonly queue: Queue<TransmitStatementJobData> | null,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async flush(): Promise<void> {
    // Kill switch: when EXTERNALIZED_CRONS contains 'xapi.flush' the
    // paired Cloud Run Job (Cloud Scheduler → XapiFlushJob.run) owns
    // this workload instead. Skipping here prevents double-execution
    // during the extraction window. Rollback = remove the name from
    // the env var and the in-container path resumes on its own.
    if (isCronExternalized('xapi.flush')) return;

    const enabled = this.configService.get<boolean>('nelc.enabled');
    if (!enabled) return;
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

    this.logger.log(`[xapi-flush] Re-enqueuing ${candidates.length} statements`);
    for (const c of candidates) {
      // Flip failed → pending so a second cron run before the worker
      // picks this up doesn't enqueue it twice.
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
