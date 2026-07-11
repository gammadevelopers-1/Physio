import { Global, Module } from '@nestjs/common';
import { JobRegistry } from './job-registry.service';

/**
 * Registry side of the Cloud Run Jobs pattern. @Global() so any module
 * that defines an extracted-cron JobHandler can inject JobRegistry
 * without listing this module in its own imports — same convenience as
 * XapiModule uses for its cross-cutting service.
 *
 * The actual JobHandler classes live in their home modules (e.g.
 * XapiFlushJob lives in XapiModule) so they can inject the same
 * dependencies the original @Cron method used. Each JobHandler's
 * constructor calls JobRegistry.register(this).
 */
@Global()
@Module({
  providers: [JobRegistry],
  exports: [JobRegistry],
})
export class JobsModule {}
