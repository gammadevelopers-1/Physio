import { Module } from '@nestjs/common';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';
import {
  MaintenanceBannerController,
  ScheduledMaintenanceController,
} from './scheduled-maintenance.controller';
import { ScheduledMaintenanceService } from './scheduled-maintenance.service';
import { ScheduledMaintenanceCron } from './scheduled-maintenance.cron';
import { ScheduledMaintenanceTickJob } from './scheduled-maintenance.jobs';

@Module({
  imports: [AdminSettingsModule],
  controllers: [
    ScheduledMaintenanceController,
    MaintenanceBannerController,
  ],
  providers: [
    ScheduledMaintenanceService,
    ScheduledMaintenanceCron,
    ScheduledMaintenanceTickJob,
  ],
  exports: [ScheduledMaintenanceService],
})
export class ScheduledMaintenanceModule {}
