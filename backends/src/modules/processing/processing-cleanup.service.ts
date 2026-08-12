import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { isCronExternalized } from '../../common/is-cron-externalized.helper';
import { eq, and, lt } from 'drizzle-orm';
import { db } from '../../database';
import { courseMaterials, MATERIAL_STATUS } from '../../database/schema';
import { DistributedLockService } from '../tasks/distributed-lock.service';

@Injectable()
export class ProcessingCleanupService {
  private readonly logger = new Logger(ProcessingCleanupService.name);

  constructor(private readonly lock: DistributedLockService) {}

  /**
   * Every 15 minutes, reap materials stuck in 'processing' for >3 hours.
   * The 3-hour threshold covers the max legitimate wallclock of a video
   * pipeline: Cloud Run video-transcode Job has a 90-min task timeout
   * and --max-retries=2, so the worst-case honest runtime is ~180 min.
   * Anything longer means the Job died in a way that didn't hit
   * markFailed() (Cloud Run force-kill, OOM, quota exhaustion, etc.).
   *
   * updatedAt is bumped at every step transition (transcoding →
   * captions → wcag → complete), so a healthy pipeline resets the
   * timer each stage. Only truly stuck rows are reaped.
   *
   * Wrapped in distributed lock so multi-instance api-web running the
   * same reap doesn't race on the UPDATE (the UPDATE itself is atomic
   * — worst case is a redundant no-op UPDATE — but skipping saves DB
   * work).
   */
  @Cron('*/15 * * * *')
  async cleanupStaleProcessing(): Promise<void> {
    if (isCronExternalized('processing.cleanup')) return;
    await this.lock.withLock('lock:cron:processing.cleanup', 4 * 60_000, () =>
      this.cleanupStaleProcessingInner(),
    );
  }

  private async cleanupStaleProcessingInner(): Promise<void> {
    const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000);

    try {
      const stale = await db
        .update(courseMaterials)
        .set({
          status: MATERIAL_STATUS.FAILED,
          processingError:
            'Processing timed out after 3 hours — the Cloud Run Job likely died or exceeded its max runtime',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(courseMaterials.status, MATERIAL_STATUS.PROCESSING),
            lt(courseMaterials.updatedAt, cutoff),
          ),
        )
        .returning({ id: courseMaterials.id });

      if (stale.length > 0) {
        this.logger.warn(`Marked ${stale.length} stale processing materials as failed: ${stale.map((s) => s.id).join(', ')}`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup stale processing materials', error);
    }
  }
}
