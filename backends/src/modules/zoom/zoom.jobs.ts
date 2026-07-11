import { Injectable } from '@nestjs/common';
import { JobHandler } from '../jobs/job-handler.interface';
import { JobRegistry } from '../jobs/job-registry.service';
import { ZoomSyncService } from './zoom-sync.service';

@Injectable()
export class ZoomSyncJob implements JobHandler {
  readonly name = 'zoom.sync';

  constructor(registry: JobRegistry, private readonly svc: ZoomSyncService) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.svc.syncRecentlyEndedSessions();
  }
}
