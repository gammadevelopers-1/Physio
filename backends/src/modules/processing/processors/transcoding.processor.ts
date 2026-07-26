import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../constants';
import { VideoTranscodeRunner } from '../services/video-transcode.runner';
import type { TranscodeJobData } from '../interfaces';

/**
 * Legacy BullMQ path for video transcoding. Kept in place ONLY as a
 * catch-net during the Cloud Run Jobs migration — the producer
 * (ProcessingService.dispatchProcessing) no longer pushes videos into
 * this queue after the migration, but leaving the worker registered
 * means any pre-migration jobs still on the queue when the code
 * rolls out get drained cleanly instead of stuck.
 *
 * All actual work lives in VideoTranscodeRunner so both this
 * (temporary) BullMQ path and the (permanent) Cloud Run Job path
 * execute the same code.
 *
 * Safe to delete this file entirely once we've verified no stray
 * transcode jobs sit in Redis for > 24h post-migration.
 */
@Processor(QUEUE_NAMES.TRANSCODING, { concurrency: 1 })
export class TranscodingProcessor extends WorkerHost {
  private readonly logger = new Logger(TranscodingProcessor.name);

  constructor(private runner: VideoTranscodeRunner) {
    super();
  }

  async process(job: Job<TranscodeJobData>): Promise<void> {
    this.logger.warn(
      `[legacy-path] Draining a pre-migration transcode job for material ${job.data.materialId}. New uploads should not reach this queue.`,
    );
    await this.runner.run({
      materialId: job.data.materialId,
      fileUrl: job.data.fileUrl,
      courseId: job.data.courseId,
      originalMimeType: job.data.originalMimeType,
      autoTranscribe: job.data.autoTranscribe,
    });
  }
}
