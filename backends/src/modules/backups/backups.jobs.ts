import { Injectable } from '@nestjs/common';
import { JobHandler } from '../jobs/job-handler.interface';
import { JobRegistry } from '../jobs/job-registry.service';
import { RestoreCloneService } from './restore-clone.service';

@Injectable()
export class BackupsPurgeClonesJob implements JobHandler {
  readonly name = 'backups.purge-clones';

  constructor(registry: JobRegistry, private readonly svc: RestoreCloneService) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.svc.purgeExpired();
  }
}
