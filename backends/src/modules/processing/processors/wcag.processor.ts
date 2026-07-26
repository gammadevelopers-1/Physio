import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../constants';
import { WcagRunner } from '../services/wcag.runner';
import type { WcagJobData } from '../interfaces';

/**
 * Legacy BullMQ path for WCAG compliance checks. Kept in place ONLY
 * as a catch-net during the Cloud Run Jobs migration — the producers
 * (CaptionsRunner, VideoTranscodeRunner, ProcessingService.dispatchWcagOnly)
 * no longer push to this queue after Phase 3, but leaving the worker
 * registered lets any pre-migration jobs still on the queue drain
 * cleanly instead of stuck.
 *
 * All actual work lives in WcagRunner. Safe to delete this file
 * entirely once no stray WCAG jobs sit in Redis for > 24h
 * post-migration.
 */
@Processor(QUEUE_NAMES.WCAG, { concurrency: 4 })
export class WcagProcessor extends WorkerHost {
  private readonly logger = new Logger(WcagProcessor.name);

  constructor(private runner: WcagRunner) {
    super();
  }

  async process(job: Job<WcagJobData>): Promise<void> {
    this.logger.warn(
      `[legacy-path] Draining a pre-migration WCAG job for material ${job.data.materialId}. New uploads should not reach this queue.`,
    );
    await this.runner.run({
      materialId: job.data.materialId,
      materialType: job.data.materialType,
      courseId: job.data.courseId,
      hasCaptions: job.data.hasCaptions,
      hasTranscript: job.data.hasTranscript,
      fileUrl: job.data.fileUrl,
      mimeType: job.data.mimeType,
    });
  }
}
