import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import { db } from '../../../database';
import { materialVariants } from '../../../database/schema';
import { QUEUE_NAMES, JOB_NAMES, PROCESSING_STEPS } from '../constants';
import { FfmpegService } from '../services/ffmpeg.service';
import { ProcessingService } from '../processing.service';
import { StorageService } from '../../storage/storage.service';
import type { TranscodeJobData, CaptionsJobData } from '../interfaces';

@Processor(QUEUE_NAMES.TRANSCODING, { concurrency: 1 })
export class TranscodingProcessor extends WorkerHost {
  private readonly logger = new Logger(TranscodingProcessor.name);

  constructor(
    private ffmpegService: FfmpegService,
    private processingService: ProcessingService,
    private storageService: StorageService,
    private configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.CAPTIONS) private captionsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WCAG) private wcagQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<TranscodeJobData>): Promise<void> {
    const { materialId, fileUrl, courseId } = job.data;
    this.logger.log(`Transcoding material ${materialId}`);

    try {
      // 1. Download source file to temp
      const tempDir = await this.ffmpegService.ensureTempDir(materialId);
      const ext = fileUrl.split('.').pop() || 'mp4';
      const inputPath = path.join(tempDir, `source.${ext}`);
      await this.downloadFile(fileUrl, inputPath);

      // 2. Get source video info
      const info = await this.ffmpegService.getVideoInfo(inputPath);
      this.logger.log(`Video info: ${info.width}x${info.height}, duration: ${info.duration}s`);

      // 3. Transcode to each resolution that's <= source
      const resolutions = this.ffmpegService.getResolutions();
      for (const config of resolutions) {
        // Skip if source is smaller than target (don't upscale)
        if (info.height < config.height && info.width < config.width) {
          this.logger.log(`Skipping ${config.label}: source ${info.width}x${info.height} < target ${config.width}x${config.height}`);
          continue;
        }

        const outputFilename = `${config.label}.mp4`;
        const outputPath = path.join(tempDir, outputFilename);

        this.logger.log(`Transcoding to ${config.label}...`);
        const { fileSize } = await this.ffmpegService.transcodeToResolution(inputPath, outputPath, config);

        // 4. Upload variant to storage
        const buffer = await this.ffmpegService.readFileAsBuffer(outputPath);
        const storagePath = `materials/${courseId}/variants/${materialId}/${outputFilename}`;
        const variantUrl = await this.storageService.uploadPublic(buffer, storagePath, 'video/mp4');

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

      // 6. Chain to captions if Whisper is available
      const openaiKey = this.configService.get<string>('processing.openai.apiKey');
      if (openaiKey) {
        await this.processingService.updateProcessingStep(materialId, PROCESSING_STEPS.GENERATING_CAPTIONS);
        await this.captionsQueue.add(
          JOB_NAMES.GENERATE_CAPTIONS,
          { materialId, fileUrl, courseId } as CaptionsJobData,
          {
            attempts: this.configService.get<number>('processing.retries.captions') || 3,
            backoff: { type: 'exponential', delay: 10000 },
            removeOnComplete: 100,
            removeOnFail: 200,
          },
        );
      } else {
        // Skip to WCAG
        await this.processingService.updateProcessingStep(materialId, PROCESSING_STEPS.WCAG_CHECK);
        await this.wcagQueue.add(JOB_NAMES.CHECK_WCAG, {
          materialId,
          materialType: 'video',
          courseId,
          hasVideo: true,
          hasCaptions: false,
          hasTranscript: false,
          fileUrl,
        });
      }
    } catch (error) {
      this.logger.error(`Transcoding failed for ${materialId}`, error);
      await this.processingService.markFailed(materialId, `Transcoding failed: ${(error as Error).message}`);
      throw error;
    } finally {
      await this.ffmpegService.cleanupTempDir(materialId);
    }
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Handle local storage URLs (relative paths)
      if (url.startsWith('/') || url.includes('localhost') || url.includes('physio-backend')) {
        // For local storage, read the file directly from the uploads directory
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

      // HTTP(S) download
      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(dest);
      protocol.get(url, (response) => {
        // Follow redirects
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
