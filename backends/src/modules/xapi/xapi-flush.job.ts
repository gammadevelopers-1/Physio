import { Injectable } from '@nestjs/common';
import { JobHandler } from '../jobs/job-handler.interface';
import { JobRegistry } from '../jobs/job-registry.service';
import { XapiFlushCron } from './xapi.flush.cron';

/**
 * Cloud Run Jobs form of XapiFlushCron.flush (hourly xAPI safety-net
 * flush). Under the standard pattern this is a thin delegator — the
 * in-container @Cron on api-web has a kill switch and Cloud Run's Job
 * runs main-job.ts which clears EXTERNALIZED_CRONS before bootstrap,
 * so calling flush() from here executes the same code path with no
 * short-circuit.
 */
@Injectable()
export class XapiFlushJob implements JobHandler {
  readonly name = 'xapi.flush';

  constructor(
    registry: JobRegistry,
    private readonly cron: XapiFlushCron,
  ) {
    registry.register(this);
  }

  async run(): Promise<void> {
    await this.cron.flush();
  }
}
