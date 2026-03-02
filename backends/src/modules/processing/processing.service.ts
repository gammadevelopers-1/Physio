import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { db } from '../../database';
import { courseMaterials, MATERIAL_STATUS } from '../../database/schema';
import { QUEUE_NAMES, JOB_NAMES, PROCESSING_STEPS } from './constants';
import type { TranscodeJobData, CaptionsJobData, WcagJobData } from './interfaces';

@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);
  private readonly redisAvailable: boolean;

  constructor(
    @Optional() @InjectQueue(QUEUE_NAMES.TRANSCODING) private transcodingQueue: Queue,
    @Optional() @InjectQueue(QUEUE_NAMES.CAPTIONS) private captionsQueue: Queue,
    @Optional() @InjectQueue(QUEUE_NAMES.WCAG) private wcagQueue: Queue,
    private configService: ConfigService,
  ) {
    this.redisAvailable = !!this.transcodingQueue;
    if (!this.redisAvailable) {
      this.logger.warn('Redis not configured — background processing is disabled');
    }
  }

  /**
   * Called by MaterialsService after successful file upload.
   * Dispatches the appropriate processing pipeline based on material type.
   */
  async dispatchProcessing(
    materialId: string,
    materialType: string,
    fileUrl: string,
    courseId: string,
    mimeType: string,
    autoTranscribe = true,
  ): Promise<void> {
    if (!this.redisAvailable) {
      this.logger.warn(`Skipping processing for material ${materialId} — Redis not available`);
      // Mark as pending review so instructor knows processing was skipped
      await this.markPendingReview(materialId);
      return;
    }
    this.logger.log(`Dispatching processing for material ${materialId} (type: ${materialType})`);

    if (materialType === 'video') {
      await this.dispatchVideoProcessing(materialId, fileUrl, courseId, mimeType, autoTranscribe);
    } else {
      // Non-video: skip directly to WCAG check
      await this.dispatchWcagOnly(materialId, materialType, fileUrl, courseId, mimeType);
    }
  }

  private async dispatchVideoProcessing(
    materialId: string,
    fileUrl: string,
    courseId: string,
    mimeType: string,
    autoTranscribe = true,
  ): Promise<void> {
    const ffmpegEnabled = this.configService.get<boolean>('processing.ffmpeg.enabled');
    const openaiKey = this.configService.get<string>('processing.openai.apiKey');

    if (ffmpegEnabled) {
      // Start with transcoding
      await this.updateProcessingStep(materialId, PROCESSING_STEPS.TRANSCODING);
      await this.transcodingQueue.add(
        JOB_NAMES.TRANSCODE_VIDEO,
        { materialId, fileUrl, courseId, originalMimeType: mimeType, autoTranscribe } as TranscodeJobData,
        {
          attempts: this.configService.get<number>('processing.retries.transcoding') || 2,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 200,

        },
      );
    } else if (openaiKey) {
      // Skip transcoding, go to captions
      await this.updateProcessingStep(materialId, PROCESSING_STEPS.GENERATING_CAPTIONS);
      await this.captionsQueue.add(
        JOB_NAMES.GENERATE_CAPTIONS,
        { materialId, fileUrl, courseId, autoTranscribe } as CaptionsJobData,
        {
          attempts: this.configService.get<number>('processing.retries.captions') || 3,
          backoff: { type: 'exponential', delay: 10000 },
          removeOnComplete: 100,
          removeOnFail: 200,

        },
      );
    } else {
      // No processing tools available — go straight to WCAG check
      this.logger.warn('Neither FFmpeg nor OpenAI configured; skipping to WCAG check');
      await this.dispatchWcagOnly(materialId, 'video', fileUrl, courseId, mimeType);
    }
  }

  async dispatchWcagOnly(
    materialId: string,
    materialType: string,
    fileUrl: string | null,
    courseId: string,
    mimeType?: string,
  ): Promise<void> {
    await this.updateProcessingStep(materialId, PROCESSING_STEPS.WCAG_CHECK);
    await this.wcagQueue.add(
      JOB_NAMES.CHECK_WCAG,
      {
        materialId,
        materialType,
        courseId,
        hasVideo: materialType === 'video',
        hasCaptions: false,
        hasTranscript: false,
        fileUrl,
        mimeType,
      } as WcagJobData,
      {
        attempts: this.configService.get<number>('processing.retries.wcag') || 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 200,

      },
    );
  }

  /** Update the processingStep column on a material record */
  async updateProcessingStep(materialId: string, step: string): Promise<void> {
    await db
      .update(courseMaterials)
      .set({ processingStep: step, updatedAt: new Date() })
      .where(eq(courseMaterials.id, materialId));
  }

  /** Mark material as failed with an error message */
  async markFailed(materialId: string, error: string): Promise<void> {
    await db
      .update(courseMaterials)
      .set({
        status: MATERIAL_STATUS.FAILED,
        processingError: error.substring(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(courseMaterials.id, materialId));
  }

  /** Mark material as live (auto-approve) or pending review (manual approval) */
  async markLive(materialId: string): Promise<void> {
    const autoApprove = this.configService.get<boolean>('processing.autoApprove');
    await db
      .update(courseMaterials)
      .set({
        status: autoApprove ? MATERIAL_STATUS.LIVE : MATERIAL_STATUS.PENDING_REVIEW,
        processingStep: PROCESSING_STEPS.COMPLETE,
        updatedAt: new Date(),
      })
      .where(eq(courseMaterials.id, materialId));
  }

  /** Mark material as pending review (WCAG fail/warning requires manager approval) */
  async markPendingReview(materialId: string): Promise<void> {
    await db
      .update(courseMaterials)
      .set({
        status: MATERIAL_STATUS.PENDING_REVIEW,
        processingStep: PROCESSING_STEPS.COMPLETE,
        updatedAt: new Date(),
      })
      .where(eq(courseMaterials.id, materialId));
  }
}
