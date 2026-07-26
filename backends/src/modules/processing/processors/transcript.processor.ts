import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '../../../database';
import { courseMaterials } from '../../../database/schema';
import { QUEUE_NAMES, JOB_NAMES, PROCESSING_STEPS } from '../constants';
import { ProcessingService } from '../processing.service';
import { StorageService } from '../../storage/storage.service';
import type { TranscriptJobData, WcagJobData } from '../interfaces';

/**
 * Legacy BullMQ path for transcript upload. Kept in place ONLY as a
 * catch-net during the Cloud Run Jobs migration — the producer (the
 * old CaptionsProcessor) no longer pushes to this queue because the
 * merged CaptionsRunner now uploads the transcript inline in the same
 * process as the captions VTT.
 *
 * Pre-migration transcript jobs already carry `captionsText` in their
 * job payload, so this drain path uploads it directly rather than
 * routing through the runner (which starts from a video URL and would
 * re-do the whole Whisper pipeline). Inline logic keeps the drain
 * cheap and side-effect-identical to the pre-migration behavior.
 *
 * Safe to delete this file entirely once no stray transcript jobs sit
 * in Redis for > 24h post-migration.
 */
@Processor(QUEUE_NAMES.TRANSCRIPT, { concurrency: 2 })
export class TranscriptProcessor extends WorkerHost {
  private readonly logger = new Logger(TranscriptProcessor.name);

  constructor(
    private processingService: ProcessingService,
    private storageService: StorageService,
    @InjectQueue(QUEUE_NAMES.WCAG) private wcagQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<TranscriptJobData>): Promise<void> {
    const { materialId, captionsText, courseId } = job.data;
    this.logger.warn(
      `[legacy-path] Draining a pre-migration transcript job for material ${materialId}. New uploads should not reach this queue.`,
    );

    try {
      const transcriptBuffer = Buffer.from(captionsText, 'utf-8');
      const transcriptPath = `materials/${courseId}/transcripts/${materialId}.txt`;
      const transcriptUrl = await this.storageService.uploadPublic(
        transcriptBuffer,
        transcriptPath,
        'text/plain',
      );

      await db
        .update(courseMaterials)
        .set({ transcriptUrl, updatedAt: new Date() })
        .where(eq(courseMaterials.id, materialId));

      const [material] = await db
        .select({
          fileUrl: courseMaterials.fileUrl,
          type: courseMaterials.type,
          captionsUrl: courseMaterials.captionsUrl,
          mimeType: courseMaterials.mimeType,
        })
        .from(courseMaterials)
        .where(eq(courseMaterials.id, materialId))
        .limit(1);

      await this.processingService.updateProcessingStep(materialId, PROCESSING_STEPS.WCAG_CHECK);
      await this.wcagQueue.add(
        JOB_NAMES.CHECK_WCAG,
        {
          materialId,
          materialType: material?.type || 'video',
          courseId,
          hasVideo: true,
          hasCaptions: !!material?.captionsUrl,
          hasTranscript: true,
          fileUrl: material?.fileUrl || null,
          mimeType: material?.mimeType || undefined,
        } as WcagJobData,
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );
    } catch (error) {
      this.logger.error(`[legacy-path] Transcript drain failed for ${materialId}`, error);
      await this.processingService.markFailed(materialId, `Transcript generation failed: ${(error as Error).message}`);
      throw error;
    }
  }
}
