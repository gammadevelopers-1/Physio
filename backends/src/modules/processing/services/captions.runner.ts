import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import { eq } from 'drizzle-orm';
import { db } from '../../../database';
import { courseMaterials } from '../../../database/schema';
import { PROCESSING_STEPS } from '../constants';
import { FfmpegService } from './ffmpeg.service';
import { WhisperService } from './whisper.service';
import { ProcessingService } from '../processing.service';
import { StorageService } from '../../storage/storage.service';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { CloudRunJobsService } from './cloud-run-jobs.service';

// Kept in sync with infra/scripts/setup-wcag-check-job.sh.
const WCAG_JOB_NAME = 'physio-job-wcag-check';

/**
 * Merged captions + transcript pipeline. Formerly two BullMQ processors
 * (CaptionsProcessor + TranscriptProcessor) that passed a ~500KB
 * `captionsText` blob between them via job data.
 *
 * The Cloud Run Jobs migration collapses them into one runner because:
 *   - Cloud Run Job env-var overrides cap at 32KB per var, so we can't
 *     hand the plaintext across a process boundary the way BullMQ did.
 *   - The old TranscriptProcessor was 6 lines of "upload text file,
 *     chain to WCAG" — the split was legacy decomposition, not
 *     principled. Merging keeps plaintext as a local variable.
 *
 * Called from TWO entry points, mirroring the VideoTranscodeRunner
 * pattern:
 *   1. Legacy BullMQ CaptionsProcessor (drain catch-net for
 *      pre-migration jobs). New writes don't reach that queue.
 *   2. Cloud Run Job entry point (CaptionsJob → `captions.generate`
 *      handler in JobRegistry). Every new video after the switch
 *      goes through this path.
 *
 * The downstream WCAG step still uses BullMQ until Phase 3 lands.
 */
@Injectable()
export class CaptionsRunner {
  private readonly logger = new Logger(CaptionsRunner.name);

  constructor(
    private ffmpegService: FfmpegService,
    private whisperService: WhisperService,
    private processingService: ProcessingService,
    private storageService: StorageService,
    private configService: ConfigService,
    private auditLogService: AuditLogService,
    private cloudRunJobs: CloudRunJobsService,
  ) {}

  async run(params: {
    materialId: string;
    fileUrl: string;
    courseId: string;
    autoTranscribe?: boolean;
  }): Promise<void> {
    const { materialId, fileUrl, courseId } = params;
    const autoTranscribe = params.autoTranscribe !== false;

    // If autoTranscribe is disabled, skip the whole pipeline and go to WCAG.
    if (!autoTranscribe) {
      this.logger.log(`Auto-transcribe disabled for material ${materialId} — skipping to WCAG`);
      await this.skipToWcag(materialId, courseId, fileUrl);
      return;
    }

    this.logger.log(`Generating captions + transcript for material ${materialId}`);

    // Look up the material's uploadedBy for audit logging.
    const [material] = await db
      .select({ uploadedBy: courseMaterials.uploadedBy })
      .from(courseMaterials)
      .where(eq(courseMaterials.id, materialId))
      .limit(1);
    const performedBy = material?.uploadedBy || materialId;

    try {
      await this.auditLogService.log({
        entityType: 'material',
        entityId: materialId,
        action: 'transcript.generation_started',
        performedBy,
        metadata: { courseId, trigger: 'auto' },
        ipAddress: 'system',
      });

      // 1. Download source video to temp.
      await this.processingService.updateProcessingStep(materialId, PROCESSING_STEPS.EXTRACTING_AUDIO);
      const tempDir = await this.ffmpegService.ensureTempDir(materialId);
      const ext = fileUrl.split('.').pop() || 'mp4';
      const videoPath = path.join(tempDir, `source.${ext}`);
      await this.downloadFile(fileUrl, videoPath);

      // 2. Extract audio as MP3.
      const audioPath = path.join(tempDir, 'audio.mp3');
      await this.ffmpegService.extractAudio(videoPath, audioPath);
      this.logger.log(`Audio extracted to ${audioPath}`);

      const audioStats = fs.statSync(audioPath);
      if (audioStats.size > 25 * 1024 * 1024) {
        this.logger.warn(`Audio file ${audioStats.size} bytes exceeds 25MB Whisper limit`);
      }

      // 3. Generate captions via Whisper.
      await this.processingService.updateProcessingStep(materialId, PROCESSING_STEPS.GENERATING_CAPTIONS);
      const result = await this.whisperService.generateCaptions(audioPath);
      this.logger.log(`Captions generated: VTT ${result.vtt.length} chars, text ${result.plainText.length} chars`);

      // 4. Upload VTT file.
      const vttBuffer = Buffer.from(result.vtt, 'utf-8');
      const vttPath = `materials/${courseId}/captions/${materialId}.vtt`;
      const captionsUrl = await this.storageService.uploadPublic(vttBuffer, vttPath, 'text/vtt');

      await db
        .update(courseMaterials)
        .set({ captionsUrl, updatedAt: new Date() })
        .where(eq(courseMaterials.id, materialId));

      this.logger.log(`Captions uploaded: ${captionsUrl}`);

      await this.auditLogService.log({
        entityType: 'material',
        entityId: materialId,
        action: 'transcript.generation_completed',
        performedBy,
        metadata: { courseId, captionsUrl, vttLength: result.vtt.length },
        ipAddress: 'system',
      });

      // 5. Upload plaintext transcript inline (formerly TranscriptProcessor).
      await this.processingService.updateProcessingStep(materialId, PROCESSING_STEPS.GENERATING_TRANSCRIPT);
      const transcriptBuffer = Buffer.from(result.plainText, 'utf-8');
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

      this.logger.log(`Transcript uploaded: ${transcriptUrl}`);

      await this.auditLogService.log({
        entityType: 'material',
        entityId: materialId,
        action: 'transcript.text_completed',
        performedBy,
        metadata: { courseId, transcriptUrl, textLength: result.plainText.length },
        ipAddress: 'system',
      });

      // 6. Chain to WCAG — Phase 3 moved this to a Cloud Run Job too.
      const [current] = await db
        .select({
          fileUrl: courseMaterials.fileUrl,
          type: courseMaterials.type,
          mimeType: courseMaterials.mimeType,
        })
        .from(courseMaterials)
        .where(eq(courseMaterials.id, materialId))
        .limit(1);

      await this.processingService.updateProcessingStep(materialId, PROCESSING_STEPS.WCAG_CHECK);
      await this.cloudRunJobs.runJob(WCAG_JOB_NAME, {
        MATERIAL_ID: materialId,
        MATERIAL_TYPE: current?.type || 'video',
        COURSE_ID: courseId,
        HAS_CAPTIONS: 'true',
        HAS_TRANSCRIPT: 'true',
        FILE_URL: current?.fileUrl || '',
        MIME_TYPE: current?.mimeType || '',
      });
    } catch (error) {
      this.logger.error(`Captions/transcript failed for ${materialId}`, error);

      await this.auditLogService.log({
        entityType: 'material',
        entityId: materialId,
        action: 'transcript.generation_failed',
        performedBy,
        metadata: { courseId, error: (error as Error).message },
        ipAddress: 'system',
      });

      await this.processingService.markFailed(
        materialId,
        `Caption generation failed: ${(error as Error).message}`,
      );
      throw error;
    } finally {
      await this.ffmpegService.cleanupTempDir(materialId);
    }
  }

  private async skipToWcag(materialId: string, courseId: string, fileUrl: string): Promise<void> {
    const [material] = await db
      .select({ mimeType: courseMaterials.mimeType })
      .from(courseMaterials)
      .where(eq(courseMaterials.id, materialId))
      .limit(1);

    await this.processingService.updateProcessingStep(materialId, PROCESSING_STEPS.WCAG_CHECK);
    await this.cloudRunJobs.runJob(WCAG_JOB_NAME, {
      MATERIAL_ID: materialId,
      MATERIAL_TYPE: 'video',
      COURSE_ID: courseId,
      HAS_CAPTIONS: 'false',
      HAS_TRANSCRIPT: 'false',
      FILE_URL: fileUrl,
      MIME_TYPE: material?.mimeType || '',
    });
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (
        url.startsWith('/') ||
        url.includes('localhost') ||
        url.includes('physio-backend')
      ) {
        const localPattern = '/storage/files/public/';
        const idx = url.indexOf(localPattern);
        if (idx !== -1) {
          const relativePath = url.substring(idx + localPattern.length);
          const localPath = path.join(
            process.cwd(),
            'uploads',
            'public',
            relativePath,
          );
          if (fs.existsSync(localPath)) {
            fs.copyFileSync(localPath, dest);
            return resolve();
          }
        }
      }

      // Same defensive pattern as VideoTranscodeRunner.downloadFile:
      // attach handlers to both http.get AND the WriteStream; guard
      // against non-2xx so a stale signed URL doesn't get piped as
      // "audio" and blow up ffmpeg with a cryptic error.
      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(dest);
      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
      protocol
        .get(url, (response) => {
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              file.close();
              return this.downloadFile(redirectUrl, dest).then(resolve, reject);
            }
          }
          if (
            !response.statusCode ||
            response.statusCode < 200 ||
            response.statusCode >= 300
          ) {
            file.close();
            fs.unlink(dest, () => {});
            return reject(
              new Error(
                `Source download failed: HTTP ${response.statusCode} for ${url}`,
              ),
            );
          }
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err) => {
          fs.unlink(dest, () => {});
          reject(err);
        });
    });
  }
}
