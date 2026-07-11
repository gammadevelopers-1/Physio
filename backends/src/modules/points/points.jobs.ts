import { Injectable } from '@nestjs/common';
import { JobHandler } from '../jobs/job-handler.interface';
import { JobRegistry } from '../jobs/job-registry.service';
import { PointsCronService } from './points.cron';

@Injectable()
export class PointsSweepHoldsJob implements JobHandler {
  readonly name = 'points.sweep-holds';

  constructor(registry: JobRegistry, private readonly cron: PointsCronService) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.cron.sweepStaleRedemptionHolds();
  }
}

@Injectable()
export class PointsLogExpiredJob implements JobHandler {
  readonly name = 'points.log-expired';

  constructor(registry: JobRegistry, private readonly cron: PointsCronService) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.cron.logExpiredEarnings();
  }
}
