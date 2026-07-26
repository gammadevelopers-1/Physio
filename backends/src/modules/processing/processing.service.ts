import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { db } from '../../database';
import { courseMaterials, MATERIAL_STATUS } from '../../database/schema';
import { PROCESSING_STEPS } from './constants';
import { CloudRunJobsService } from './services/cloud-run-jobs.service';

// Cloud Run Job names — kept here as constants so producer + infra
// script + Job definition all reference the same string. See the
// setup scripts under infra/scripts/.
const VIDEO_TRANSCODE_JOB_NAME = 'physio-job-video-transcode';
const CAPTIONS_JOB_NAME = 'physio-job-captions-generate';
const WCAG_JOB_NAME = 'physio-job-wcag-check';

@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(
    private configService: ConfigService,
    private cloudRunJobs: CloudRunJobsService,
  ) {
    // Post-Phase 3, all three processing steps (transcode, captions,
    // WCAG) run as Cloud Run Jobs — nothing on this service touches
    // BullMQ anymore. The legacy queues are still registered in the
    // module so their processors can drain any pre-migration jobs.
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
    this.logger.log(`Dispatching processing for material ${materialId} (type: ${materialType})`);

    if (materialType === 'video') {
      // Videos ALWAYS go to Cloud Run Jobs now — the on-cluster BullMQ
      // path OOM'd on the always-on worker (see 2026-07-22 incident).
      await this.dispatchVideoProcessing(materialId, fileUrl, courseId, mimeType, autoTranscribe);
    } else {
      // Non-video (pdf/document/image): skip directly to the WCAG
      // Cloud Run Job — no transcoding, no captions.
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
      // Trigger Cloud Run Job — pay-per-execution, no idle worker cost.
      // The runner (VideoTranscodeRunner) does the whole ffmpeg pipeline
      // + chains to captions/WCAG (still BullMQ for those in Phase 1).
      await this.updateProcessingStep(materialId, PROCESSING_STEPS.TRANSCODING);
      try {
        await this.cloudRunJobs.runJob(VIDEO_TRANSCODE_JOB_NAME, {
          MATERIAL_ID: materialId,
          FILE_URL: fileUrl,
          COURSE_ID: courseId,
          ORIGINAL_MIME_TYPE: mimeType,
          AUTO_TRANSCRIBE: String(autoTranscribe),
        });
      } catch (err) {
        // Failing to TRIGGER (auth, quota, job missing) leaves the row
        // in TRANSCODING forever otherwise — mark it failed so the
        // instructor gets a clear error and can retry, rather than
        // silently orphaning it. The runner itself marks failed on
        // in-job errors; this handles the "dispatch never landed" case.
        this.logger.error(
          `Failed to trigger Cloud Run Job for material ${materialId}: ${(err as Error).message}`,
        );
        await this.markFailed(
          materialId,
          `Failed to start transcoding: ${(err as Error).message}`,
        );
        throw err;
      }
    } else if (openaiKey) {
      // ffmpeg disabled but OpenAI available — skip transcoding and go
      // straight to the captions Cloud Run Job.
      await this.updateProcessingStep(materialId, PROCESSING_STEPS.GENERATING_CAPTIONS);
      await this.cloudRunJobs.runJob(CAPTIONS_JOB_NAME, {
        MATERIAL_ID: materialId,
        FILE_URL: fileUrl,
        COURSE_ID: courseId,
        AUTO_TRANSCRIBE: String(autoTranscribe),
      });
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
    // Post-Phase 3: trigger the WCAG Cloud Run Job instead of BullMQ.
    // Non-video materials (pdf/document/image) land here directly from
    // dispatchProcessing; they still need file inspection so FILE_URL
    // is real, not the video-skip empty string.
    await this.updateProcessingStep(materialId, PROCESSING_STEPS.WCAG_CHECK);
    try {
      await this.cloudRunJobs.runJob(WCAG_JOB_NAME, {
        MATERIAL_ID: materialId,
        MATERIAL_TYPE: materialType,
        COURSE_ID: courseId,
        HAS_CAPTIONS: 'false',
        HAS_TRANSCRIPT: 'false',
        FILE_URL: fileUrl || '',
        MIME_TYPE: mimeType || '',
      });
    } catch (err) {
      this.logger.error(
        `Failed to trigger WCAG Cloud Run Job for material ${materialId}: ${(err as Error).message}`,
      );
      await this.markFailed(
        materialId,
        `Failed to start WCAG check: ${(err as Error).message}`,
      );
      throw err;
    }
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

  /** Mark material as live — WCAG passed, no manager review needed */
  async markLive(materialId: string): Promise<void> {
    await db
      .update(courseMaterials)
      .set({
        status: MATERIAL_STATUS.LIVE,
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
