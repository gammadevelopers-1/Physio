import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { db } from '../../../database';
import { courseMaterials } from '../../../database/schema';
import { QUEUE_NAMES, JOB_NAMES, PROCESSING_STEPS } from '../constants';
import { FfmpegService } from '../services/ffmpeg.service';
import { WhisperService } from '../services/whisper.service';
import { ProcessingService } from '../processing.service';
import { StorageService } from '../../storage/storage.service';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import type { CaptionsJobData, TranscriptJobData, WcagJobData } from '../interfaces';

@Processor(QUEUE_NAMES.CAPTIONS, { concurrency: 2 })
export class CaptionsProcessor extends WorkerHost {
  private readonly logger = new Logger(CaptionsProcessor.name);

  constructor(
    private ffmpegService: FfmpegService,
    private whisperService: WhisperService,
    private processingService: ProcessingService,
    private storageService: StorageService,
    private configService: ConfigService,
    private auditLogService: AuditLogService,
    @InjectQueue(QUEUE_NAMES.TRANSCRIPT) private transcriptQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WCAG) private wcagQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<CaptionsJobData>): Promise<void> {
    const { materialId, fileUrl, courseId } = job.data;

    // If autoTranscribe is disabled, skip captions and go to WCAG
    if (job.data.autoTranscribe === false) {
      this.logger.log(`Auto-transcribe disabled for material ${materialId} — skipping to WCAG`);
      await this.skipToWcag(materialId, courseId, fileUrl);
      return;
    }

    this.logger.log(`Generating captions for material ${materialId}`);

    // Look up the material's uploadedBy for audit logging
    const [material] = await db
      .select({ uploadedBy: courseMaterials.uploadedBy })
      .from(courseMaterials)
      .where(eq(courseMaterials.id, materialId))
      .limit(1);
    const performedBy = material?.uploadedBy || materialId;

    try {
      // Audit: transcript generation started
      await this.auditLogService.log({
        entityType: 'material',
        entityId: materialId,
        action: 'transcript.generation_started',
        performedBy,
        metadata: { courseId, trigger: 'auto' },
        ipAddress: 'system',
      });

      // 1. Download source video to temp
      await this.processingService.updateProcessingStep(materialId, PROCESSING_STEPS.EXTRACTING_AUDIO);
      const tempDir = await this.ffmpegService.ensureTempDir(materialId);
      const ext = fileUrl.split('.').pop() || 'mp4';
      const videoPath = path.join(tempDir, `source.${ext}`);
      await this.downloadFile(fileUrl, videoPath);

      // 2. Extract audio as MP3
      const audioPath = path.join(tempDir, 'audio.mp3');
      await this.ffmpegService.extractAudio(videoPath, audioPath);
      this.logger.log(`Audio extracted to ${audioPath}`);

      // Check audio file size (Whisper limit is 25MB)
      const audioStats = fs.statSync(audioPath);
      if (audioStats.size > 25 * 1024 * 1024) {
        this.logger.warn(`Audio file ${audioStats.size} bytes exceeds 25MB Whisper limit`);
        // For large audio, we still try — Whisper may handle it or we fail gracefully
      }

      // 3. Generate captions via Whisper
      await this.processingService.updateProcessingStep(materialId, PROCESSING_STEPS.GENERATING_CAPTIONS);
      const result = await this.whisperService.generateCaptions(audioPath);
      this.logger.log(`Captions generated: VTT ${result.vtt.length} chars, text ${result.plainText.length} chars`);

      // 4. Upload VTT file to storage
      const vttBuffer = Buffer.from(result.vtt, 'utf-8');
      const vttPath = `materials/${courseId}/captions/${materialId}.vtt`;
      const captionsUrl = await this.storageService.uploadPublic(vttBuffer, vttPath, 'text/vtt');

      // 5. Update captionsUrl in DB
      await db
        .update(courseMaterials)
        .set({ captionsUrl, updatedAt: new Date() })
        .where(eq(courseMaterials.id, materialId));

      this.logger.log(`Captions uploaded: ${captionsUrl}`);

      // Audit: transcript generation completed
      await this.auditLogService.log({
        entityType: 'material',
        entityId: materialId,
        action: 'transcript.generation_completed',
        performedBy,
        metadata: { courseId, captionsUrl, vttLength: result.vtt.length },
        ipAddress: 'system',
      });

      // 6. Chain to transcript generation
      await this.processingService.updateProcessingStep(materialId, PROCESSING_STEPS.GENERATING_TRANSCRIPT);
      await this.transcriptQueue.add(
        JOB_NAMES.GENERATE_TRANSCRIPT,
        { materialId, captionsText: result.plainText, courseId } as TranscriptJobData,
        {
          attempts: 2,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );
    } catch (error) {
      this.logger.error(`Caption generation failed for ${materialId}`, error);

      // Audit: transcript generation failed
      await this.auditLogService.log({
        entityType: 'material',
        entityId: materialId,
        action: 'transcript.generation_failed',
        performedBy,
        metadata: { courseId, error: (error as Error).message },
        ipAddress: 'system',
      });

      await this.processingService.markFailed(materialId, `Caption generation failed: ${(error as Error).message}`);
      throw error;
    } finally {
      await this.ffmpegService.cleanupTempDir(materialId);
    }
  }

  /** Skip captions/transcript and go directly to WCAG check */
  private async skipToWcag(materialId: string, courseId: string, fileUrl: string): Promise<void> {
    const [material] = await db
      .select({ mimeType: courseMaterials.mimeType })
      .from(courseMaterials)
      .where(eq(courseMaterials.id, materialId))
      .limit(1);

    await this.processingService.updateProcessingStep(materialId, PROCESSING_STEPS.WCAG_CHECK);
    await this.wcagQueue.add(JOB_NAMES.CHECK_WCAG, {
      materialId,
      materialType: 'video',
      courseId,
      hasVideo: true,
      hasCaptions: false,
      hasTranscript: false,
      fileUrl,
      mimeType: material?.mimeType || undefined,
    } as WcagJobData, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Handle local storage URLs
      if (url.startsWith('/') || url.includes('localhost') || url.includes('physio-backend')) {
        const localPattern = '/storage/files/public/';
        const idx = url.indexOf(localPattern);
        if (idx !== -1) {
          const relativePath = url.substring(idx + localPattern.length);
          const localPath = path.join(process.cwd(), 'uploads', 'public', relativePath);
          if (fs.existsSync(localPath)) {
            fs.copyFileSync(localPath, dest);
            return resolve();
          }
        }
      }

      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(dest);
      protocol.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            return this.downloadFile(redirectUrl, dest).then(resolve, reject);
          }
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });
  }
}
