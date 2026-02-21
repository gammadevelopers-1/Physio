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
    this.logger.log(`Generating transcript for material ${materialId}`);

    try {
      // 1. Upload plain text transcript to storage
      const transcriptBuffer = Buffer.from(captionsText, 'utf-8');
      const transcriptPath = `materials/${courseId}/transcripts/${materialId}.txt`;
      const transcriptUrl = await this.storageService.uploadPublic(
        transcriptBuffer,
        transcriptPath,
        'text/plain',
      );

      // 2. Update transcriptUrl in DB
      await db
        .update(courseMaterials)
        .set({ transcriptUrl, updatedAt: new Date() })
        .where(eq(courseMaterials.id, materialId));

      this.logger.log(`Transcript uploaded: ${transcriptUrl}`);

      // 3. Chain to WCAG check
      // Get the material to check current state
      const [material] = await db
        .select({ fileUrl: courseMaterials.fileUrl, type: courseMaterials.type, captionsUrl: courseMaterials.captionsUrl })
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
        } as WcagJobData,
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );
    } catch (error) {
      this.logger.error(`Transcript generation failed for ${materialId}`, error);
      await this.processingService.markFailed(materialId, `Transcript generation failed: ${(error as Error).message}`);
      throw error;
    }
  }
}
