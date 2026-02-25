import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '../../../database';
import { courseMaterials } from '../../../database/schema';
import { QUEUE_NAMES } from '../constants';
import { WcagService } from '../services/wcag.service';
import { ProcessingService } from '../processing.service';
import type { WcagJobData } from '../interfaces';

@Processor(QUEUE_NAMES.WCAG, { concurrency: 4 })
export class WcagProcessor extends WorkerHost {
  private readonly logger = new Logger(WcagProcessor.name);

  constructor(
    private wcagService: WcagService,
    private processingService: ProcessingService,
  ) {
    super();
  }

  async process(job: Job<WcagJobData>): Promise<void> {
    const { materialId, materialType, hasCaptions, hasTranscript } = job.data;
    this.logger.log(`Running WCAG check for material ${materialId}`);

    try {
      // 1. Run WCAG compliance check
      const result = this.wcagService.checkCompliance({
        materialType,
        hasCaptions,
        hasTranscript,
      });

      this.logger.log(`WCAG result for ${materialId}: ${result.status} — ${result.details.join(', ')}`);

      // 2. Update wcagStatus in DB
      // Map wcag service statuses to schema values: pass/warning → compliant, fail → fail
      const wcagStatusMap: Record<string, string> = {
        pass: 'compliant',
        warning: 'warning',
        fail: 'fail',
      };
      await db
        .update(courseMaterials)
        .set({ wcagStatus: wcagStatusMap[result.status] || 'pending', updatedAt: new Date() })
        .where(eq(courseMaterials.id, materialId));

      // 3. Mark material as live (processing complete)
      await this.processingService.markLive(materialId);
      this.logger.log(`Material ${materialId} processing complete — marked as live`);
    } catch (error) {
      this.logger.error(`WCAG check failed for ${materialId}`, error);
      await this.processingService.markFailed(materialId, `WCAG check failed: ${(error as Error).message}`);
      throw error;
    }
  }
}
