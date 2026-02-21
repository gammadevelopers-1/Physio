import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { eq, and, lt } from 'drizzle-orm';
import { db } from '../../database';
import { courseMaterials, MATERIAL_STATUS } from '../../database/schema';

@Injectable()
export class ProcessingCleanupService {
  private readonly logger = new Logger(ProcessingCleanupService.name);

  /**
   * Every 15 minutes, check for materials stuck in 'processing' for over 1 hour.
   * Mark them as 'failed' with a timeout error.
   */
  @Cron('*/15 * * * *')
  async cleanupStaleProcessing(): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    try {
      const stale = await db
        .update(courseMaterials)
        .set({
          status: MATERIAL_STATUS.FAILED,
          processingError: 'Processing timed out after 1 hour',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(courseMaterials.status, MATERIAL_STATUS.PROCESSING),
            lt(courseMaterials.updatedAt, oneHourAgo),
          ),
        )
        .returning({ id: courseMaterials.id });

      if (stale.length > 0) {
        this.logger.warn(`Marked ${stale.length} stale processing materials as failed: ${stale.map((s) => s.id).join(', ')}`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup stale processing materials', error);
    }
  }
}
