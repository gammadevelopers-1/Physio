import { Injectable } from '@nestjs/common';
import { JobHandler } from '../jobs/job-handler.interface';
import { JobRegistry } from '../jobs/job-registry.service';
import { ScheduledMaintenanceCron } from './scheduled-maintenance.cron';

@Injectable()
export class ScheduledMaintenanceTickJob implements JobHandler {
  readonly name = 'scheduled-maintenance.tick';

  constructor(
    registry: JobRegistry,
    private readonly cron: ScheduledMaintenanceCron,
  ) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.cron.tick();
  }
}
