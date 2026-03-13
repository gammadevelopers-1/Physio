import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ThresholdEvaluationService } from './threshold-evaluation.service';

@Injectable()
export class TaDeactivationCronService {
  private readonly logger = new Logger(TaDeactivationCronService.name);

  constructor(
    private readonly thresholdService: ThresholdEvaluationService,
  ) {}

  /**
   * Process scheduled deactivations every hour.
   * TAs with deactivation_scheduled_at older than 24h get deactivated
   * (unless enrollment has recovered — EC-22).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processScheduledDeactivations(): Promise<void> {
    this.logger.log('Running TA deactivation cron job...');
    try {
      await this.thresholdService.processScheduledDeactivations();
      this.logger.log('TA deactivation cron job completed');
    } catch (error) {
      this.logger.error(
        `TA deactivation cron job failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
