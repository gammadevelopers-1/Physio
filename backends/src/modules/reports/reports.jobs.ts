import { Injectable } from '@nestjs/common';
import { JobHandler } from '../jobs/job-handler.interface';
import { JobRegistry } from '../jobs/job-registry.service';
import { ReportSchedulerService } from './report-scheduler.service';

@Injectable()
export class ReportsScheduleJob implements JobHandler {
  readonly name = 'reports.schedule';

  constructor(
    registry: JobRegistry,
    private readonly svc: ReportSchedulerService,
  ) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.svc.handleScheduledReports();
  }
}
