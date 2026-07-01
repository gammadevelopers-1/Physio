import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { XAPI_QUEUE_NAMES } from './constants';
import { XapiService } from './xapi.service';
import { LrsClient } from './lrs.client';
import { XapiProcessor } from './xapi.processor';
import { XapiFlushCron } from './xapi.flush.cron';
import { XapiContextHelper } from './xapi-context.helper';
import { XapiAdminController } from './xapi.admin.controller';
import { NelcModeService } from './nelc-mode.service';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';

// Same pattern as ProcessingModule — only register the BullMQ queue +
// processor when Redis is available. Local dev without Redis still
// works: XapiService.emit() persists the row but skips enqueue, and
// the cron is a no-op until Redis comes online.
const redisEnabled = !!process.env.REDIS_HOST;

// @Global() mirrors NelcAuditModule — emission hooks live in every
// service module (auth, enrollments, student, assessments, zoom,
// courses, certificates). Making it global lets each module inject
// XapiService without listing XapiModule in its imports.
@Global()
@Module({
  imports: [
    AdminSettingsModule,
    ...(redisEnabled
      ? [BullModule.registerQueue({ name: XAPI_QUEUE_NAMES.STATEMENTS })]
      : []),
  ],
  controllers: [XapiAdminController],
  providers: [
    XapiContextHelper,
    NelcModeService,
    XapiService,
    LrsClient,
    ...(redisEnabled ? [XapiProcessor] : []),
    XapiFlushCron,
  ],
  exports: [XapiService, NelcModeService],
})
export class XapiModule {}
