import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  xapiStatements,
  xapiTransmissions,
  XAPI_STATEMENT_STATUS,
} from '../../database/schema';
import { XAPI_QUEUE_NAMES, type TransmitStatementJobData } from './constants';
import { LrsClient } from './lrs.client';

/**
 * BullMQ worker that picks up enqueued statement ids, POSTs the stored
 * payload to NELC's LRS, and records the attempt.
 *
 * Concurrency is conservative (4) so a thundering-herd login event
 * doesn't flood the LRS — NELC's staging hasn't been load-tested by
 * us, so we'd rather queue than 429.
 */
@Processor(XAPI_QUEUE_NAMES.STATEMENTS, { concurrency: 4 })
export class XapiProcessor extends WorkerHost {
  private readonly logger = new Logger(XapiProcessor.name);

  constructor(private readonly lrs: LrsClient) {
    super();
  }

  async process(job: Job<TransmitStatementJobData>): Promise<void> {
    const { statementId } = job.data;

    const [row] = await db
      .select({
        id: xapiStatements.id,
        payload: xapiStatements.payload,
        status: xapiStatements.status,
      })
      .from(xapiStatements)
      .where(eq(xapiStatements.id, statementId));

    if (!row) {
      this.logger.warn(`[xapi] Statement ${statementId} not found — dropping job`);
      return;
    }
    if (row.status === XAPI_STATEMENT_STATUS.SENT) {
      this.logger.debug(`[xapi] Statement ${statementId} already sent — skipping`);
      return;
    }

    // Determine next attempt number from any prior transmission rows
    // (the cron flush re-enqueues failed statements, so attempt_no
    // continues across reschedules).
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(xapiTransmissions)
      .where(eq(xapiTransmissions.statementId, statementId));
    const attemptNo = (count ?? 0) + 1;

    const result = await this.lrs.postStatement(
      row.payload as Record<string, unknown>,
    );

    await db.insert(xapiTransmissions).values({
      statementId,
      attemptNo,
      httpStatus: result.httpStatus,
      responseBody: result.responseBody,
      errorText: result.errorText,
    });

    if (result.ok) {
      await db
        .update(xapiStatements)
        .set({
          status: XAPI_STATEMENT_STATUS.SENT,
          sentAt: new Date(),
        })
        .where(eq(xapiStatements.id, statementId));
      this.logger.log(
        `[xapi] Sent statement ${statementId} (HTTP ${result.httpStatus})`,
      );
    } else {
      await db
        .update(xapiStatements)
        .set({ status: XAPI_STATEMENT_STATUS.FAILED })
        .where(eq(xapiStatements.id, statementId));
      this.logger.warn(
        `[xapi] Failed statement ${statementId} (HTTP ${result.httpStatus ?? 'no-response'}) — ${result.errorText ?? result.responseBody.slice(0, 200)}`,
      );
    }
  }
}
