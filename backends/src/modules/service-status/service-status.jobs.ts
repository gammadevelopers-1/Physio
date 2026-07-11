import { Injectable } from '@nestjs/common';
import { JobHandler } from '../jobs/job-handler.interface';
import { JobRegistry } from '../jobs/job-registry.service';
import { ServiceStatusCron } from './service-status.cron';
import { IncidentSuggestionCron } from './incident-suggestion.cron';

@Injectable()
export class ServiceStatusCheckJob implements JobHandler {
  readonly name = 'service-status.check';

  constructor(
    registry: JobRegistry,
    private readonly cron: ServiceStatusCron,
  ) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.cron.handleCron();
  }
}

@Injectable()
export class IncidentSuggestionJob implements JobHandler {
  readonly name = 'service-status.incident-suggestion';

  constructor(
    registry: JobRegistry,
    private readonly cron: IncidentSuggestionCron,
  ) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.cron.run();
  }
}
