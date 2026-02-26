import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { db } from '../../../database';
import { courseMaterials } from '../../../database/schema';
import { QUEUE_NAMES } from '../constants';
import { WcagService } from '../services/wcag.service';
import { ProcessingService } from '../processing.service';
import type { WcagJobData } from '../interfaces';

@Processor(QUEUE_NAMES.WCAG, { concurrency: 4 })
export class WcagProcessor extends WorkerHost {
  private readonly logger = new Logger(WcagProcessor.name);
  private readonly tempDir: string;

  constructor(
    private wcagService: WcagService,
    private processingService: ProcessingService,
    private configService: ConfigService,
  ) {
    super();
    this.tempDir = this.configService.get<string>('processing.tempDir') || '/tmp/physio-processing';
  }

  async process(job: Job<WcagJobData>): Promise<void> {
    const { materialId, materialType, hasCaptions, hasTranscript, fileUrl, mimeType } = job.data;
    this.logger.log(`Running WCAG check for material ${materialId} (type: ${materialType})`);

    let tempFilePath: string | null = null;
    let tempDirPath: string | null = null;

    try {
      // 1. Download file to temp if fileUrl is available
      if (fileUrl) {
        tempDirPath = path.join(this.tempDir, `wcag-${materialId}`);
        fs.mkdirSync(tempDirPath, { recursive: true });
        const ext = fileUrl.split('.').pop() || 'bin';
        tempFilePath = path.join(tempDirPath, `source.${ext}`);
        await this.downloadFile(fileUrl, tempFilePath);
        this.logger.log(`Downloaded file for WCAG inspection: ${tempFilePath}`);
      }

      // 2. Run WCAG compliance check with actual file
      const result = await this.wcagService.checkCompliance({
        materialType,
        hasCaptions,
        hasTranscript,
        filePath: tempFilePath,
        mimeType,
      });

      this.logger.log(
        `WCAG result for ${materialId}: ${result.status} (score: ${result.score}) — ` +
        result.details.map(d => `${d.passed ? 'PASS' : 'FAIL'} ${d.label}`).join(', '),
      );

      // 3. Update wcagStatus + wcagDetails in DB
      const wcagStatusMap: Record<string, string> = {
        pass: 'compliant',
        warning: 'warning',
        fail: 'fail',
      };
      await db
        .update(courseMaterials)
        .set({
          wcagStatus: wcagStatusMap[result.status] || 'pending',
          wcagDetails: JSON.stringify(result.details),
          updatedAt: new Date(),
        })
        .where(eq(courseMaterials.id, materialId));

      // 4. Mark material as live (processing complete)
      await this.processingService.markLive(materialId);
      this.logger.log(`Material ${materialId} processing complete — marked as live`);
    } catch (error) {
      this.logger.error(`WCAG check failed for ${materialId}`, error);
      await this.processingService.markFailed(materialId, `WCAG check failed: ${(error as Error).message}`);
      throw error;
    } finally {
      // 5. Cleanup temp files
      if (tempDirPath) {
        try {
          fs.rmSync(tempDirPath, { recursive: true, force: true });
        } catch {
          // Cleanup failure is non-critical
        }
      }
    }
  }

  /**
   * Download a file from URL or local storage path to a destination.
   * Reuses the same pattern from TranscodingProcessor/CaptionsProcessor.
   */
  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Handle local storage URLs (relative paths)
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
