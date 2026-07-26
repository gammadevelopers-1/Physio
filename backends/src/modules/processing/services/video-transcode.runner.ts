import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import { db } from '../../../database';
import { materialVariants } from '../../../database/schema';
import { PROCESSING_STEPS } from '../constants';
import { FfmpegService } from './ffmpeg.service';
import { ProcessingService } from '../processing.service';
import { StorageService } from '../../storage/storage.service';
import { CloudRunJobsService } from './cloud-run-jobs.service';

// Kept in sync with infra/scripts/setup-captions-generate-job.sh.
// See ProcessingService for the sibling VIDEO_TRANSCODE_JOB_NAME.
const CAPTIONS_JOB_NAME = 'physio-job-captions-generate';

// Kept in sync with infra/scripts/setup-wcag-check-job.sh.
const WCAG_JOB_NAME = 'physio-job-wcag-check';

/**
 * Pure video transcoding pipeline — the work formerly done inside
 * TranscodingProcessor.process(). Extracted into its own service so it
 * can be invoked from TWO entry points without duplication:
 *
 *   1. The BullMQ TranscodingProcessor (kept as a thin wrapper for
 *      backwards compatibility during the rollout window — the
 *      producer no longer pushes to this queue, but leaving the
 *      processor registered means any in-flight jobs at the moment of
 *      the switchover still finish cleanly).
 *   2. The Cloud Run Job entry point (`video.transcode` handler in the
 *      JobRegistry), which reads params from process.env and calls
 *      run(). Every new video upload after the switch goes through
 *      this path — pay-per-execution, no always-on worker needed.
 *
 * The dispatch chain after Phase 2: transcode → CAPTIONS (Cloud Run
 * Job) → WCAG (still BullMQ, waiting on Phase 3).
 */
@Injectable()
export class VideoTranscodeRunner {
  private readonly logger = new Logger(VideoTranscodeRunner.name);

  constructor(
    private ffmpegService: FfmpegService,
    private processingService: ProcessingService,
    private storageService: StorageService,
    private configService: ConfigService,
    private cloudRunJobs: CloudRunJobsService,
  ) {}

  async run(params: {
    materialId: string;
    fileUrl: string;
    courseId: string;
    originalMimeType?: string;
    autoTranscribe?: boolean;
  }): Promise<void> {
    const { materialId, fileUrl, courseId, originalMimeType } = params;
    const autoTranscribe = params.autoTranscribe !== false;
    this.logger.log(`Transcoding material ${materialId}`);

    try {
      // 1. Download source file to temp
      const tempDir = await this.ffmpegService.ensureTempDir(materialId);
      const ext = fileUrl.split('.').pop() || 'mp4';
      const inputPath = path.join(tempDir, `source.${ext}`);
      await this.downloadFile(fileUrl, inputPath);

      // 2. Get source video info
      const info = await this.ffmpegService.getVideoInfo(inputPath);
      this.logger.log(
        `Video info: ${info.width}x${info.height}, duration: ${info.duration}s`,
      );

      // 3. Transcode to each resolution that's <= source
      const resolutions = this.ffmpegService.getResolutions();
      for (const config of resolutions) {
        if (info.height < config.height && info.width < config.width) {
          this.logger.log(
            `Skipping ${config.label}: source ${info.width}x${info.height} < target ${config.width}x${config.height}`,
          );
          continue;
        }

        const outputFilename = `${config.label}.mp4`;
        const outputPath = path.join(tempDir, outputFilename);

        this.logger.log(`Transcoding to ${config.label}...`);
        const { fileSize } = await this.ffmpegService.transcodeToResolution(
          inputPath,
          outputPath,
          config,
        );

        // 4. Upload variant to storage
        const buffer = await this.ffmpegService.readFileAsBuffer(outputPath);
        const storagePath = `materials/${courseId}/variants/${materialId}/${outputFilename}`;
        const variantUrl = await this.storageService.uploadPublic(
          buffer,
          storagePath,
          'video/mp4',
        );

        // 5. Insert variant record
        await db.insert(materialVariants).values({
          materialId,
          resolution: config.label,
          fileUrl: variantUrl,
          fileSize,
          width: config.width,
          height: config.height,
          bitrate: config.videoBitrate,
          mimeType: 'video/mp4',
        });

        this.logger.log(`${config.label} variant uploaded: ${variantUrl}`);

        // Clean up output file
        await this.ffmpegService.deleteTempFile(outputPath);
      }

      // 6. Chain to captions if Whisper is available and autoTranscribe is enabled.
      // Post-Phase 2 this triggers a Cloud Run Job (physio-job-captions-generate)
      // instead of pushing to the BullMQ captions queue — same pay-per-execution
      // model as the transcode job itself.
      const openaiKey = this.configService.get<string>(
        'processing.openai.apiKey',
      );
      if (openaiKey && autoTranscribe) {
        await this.processingService.updateProcessingStep(
          materialId,
          PROCESSING_STEPS.GENERATING_CAPTIONS,
        );
        await this.cloudRunJobs.runJob(CAPTIONS_JOB_NAME, {
          MATERIAL_ID: materialId,
          FILE_URL: fileUrl,
          COURSE_ID: courseId,
          AUTO_TRANSCRIBE: String(autoTranscribe),
        });
      } else {
        // Skip captions and go straight to WCAG (Cloud Run Job after
        // Phase 3 — no captions/transcript, so booleans are false).
        await this.processingService.updateProcessingStep(
          materialId,
          PROCESSING_STEPS.WCAG_CHECK,
        );
        await this.cloudRunJobs.runJob(WCAG_JOB_NAME, {
          MATERIAL_ID: materialId,
          MATERIAL_TYPE: 'video',
          COURSE_ID: courseId,
          HAS_CAPTIONS: 'false',
          HAS_TRANSCRIPT: 'false',
          FILE_URL: fileUrl,
          MIME_TYPE: originalMimeType || '',
        });
      }
    } catch (error) {
      this.logger.error(`Transcoding failed for ${materialId}`, error);
      await this.processingService.markFailed(
        materialId,
        `Transcoding failed: ${(error as Error).message}`,
      );
      throw error;
    } finally {
      await this.ffmpegService.cleanupTempDir(materialId);
    }
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Handle local storage URLs (relative paths)
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

      // HTTP(S) download. Both the http.get AND the WriteStream can
      // emit 'error' — attach handlers to BOTH, otherwise a WriteStream
      // error (bad dest path, disk full, EACCES) becomes an unhandled
      // event that crashes the process before the runner's catch block
      // can mark the material failed. In a Cloud Run Job that surfaces
      // as an exit(1) without any DB update, leaving the row stuck in
      // 'processing' — exactly the incident the migration is meant to
      // prevent.
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
          // Non-2xx (e.g. 404 on a stale signed URL) — bail early
          // rather than piping a JSON/HTML error body into a video file.
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
