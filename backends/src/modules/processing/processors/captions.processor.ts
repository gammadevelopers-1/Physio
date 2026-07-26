import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../constants';
import { CaptionsRunner } from '../services/captions.runner';
import type { CaptionsJobData } from '../interfaces';

/**
 * Legacy BullMQ path for caption/transcript generation. Kept in place
 * ONLY as a catch-net during the Cloud Run Jobs migration — the
 * producer (VideoTranscodeRunner) no longer pushes to this queue after
 * Phase 2, but leaving the worker registered lets any pre-migration
 * jobs still on the queue drain cleanly instead of stuck.
 *
 * All actual work now lives in CaptionsRunner (which also inlines what
 * used to be TranscriptProcessor). Safe to delete this file entirely
 * once no stray caption jobs sit in Redis for > 24h post-migration.
 */
@Processor(QUEUE_NAMES.CAPTIONS, { concurrency: 2 })
export class CaptionsProcessor extends WorkerHost {
  private readonly logger = new Logger(CaptionsProcessor.name);

  constructor(private runner: CaptionsRunner) {
    super();
  }

  async process(job: Job<CaptionsJobData>): Promise<void> {
    this.logger.warn(
      `[legacy-path] Draining a pre-migration captions job for material ${job.data.materialId}. New uploads should not reach this queue.`,
    );
    await this.runner.run({
      materialId: job.data.materialId,
      fileUrl: job.data.fileUrl,
      courseId: job.data.courseId,
      autoTranscribe: job.data.autoTranscribe,
    });
  }
}
