import { Module } from '@nestjs/common';
import {
  AuthedServiceStatusController,
  PublicServiceStatusController,
  ServiceStatusController,
} from './service-status.controller';
import { ServiceStatusService } from './service-status.service';
import { ServiceStatusCron } from './service-status.cron';
import { IncidentSuggestionCron } from './incident-suggestion.cron';

@Module({
  controllers: [
    PublicServiceStatusController,
    AuthedServiceStatusController,
    ServiceStatusController,
  ],
  providers: [ServiceStatusService, ServiceStatusCron, IncidentSuggestionCron],
  exports: [ServiceStatusService],
})
export class ServiceStatusModule {}
