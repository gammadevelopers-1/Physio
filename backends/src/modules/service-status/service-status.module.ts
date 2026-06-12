import { Module } from '@nestjs/common';
import {
  PublicServiceStatusController,
  ServiceStatusController,
} from './service-status.controller';
import { ServiceStatusService } from './service-status.service';
import { ServiceStatusCron } from './service-status.cron';

@Module({
  controllers: [PublicServiceStatusController, ServiceStatusController],
  providers: [ServiceStatusService, ServiceStatusCron],
  exports: [ServiceStatusService],
})
export class ServiceStatusModule {}
