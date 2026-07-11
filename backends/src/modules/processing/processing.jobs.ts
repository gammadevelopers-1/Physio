import { Injectable } from '@nestjs/common';
import { JobHandler } from '../jobs/job-handler.interface';
import { JobRegistry } from '../jobs/job-registry.service';
import { ProcessingCleanupService } from './processing-cleanup.service';

@Injectable()
export class ProcessingCleanupJob implements JobHandler {
  readonly name = 'processing.cleanup';

  constructor(
    registry: JobRegistry,
    private readonly service: ProcessingCleanupService,
  ) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.service.cleanupStaleProcessing();
  }
}
