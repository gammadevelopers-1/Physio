import { Module } from '@nestjs/common';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';
import {
  MaintenanceBannerController,
  ScheduledMaintenanceController,
} from './scheduled-maintenance.controller';
import { ScheduledMaintenanceService } from './scheduled-maintenance.service';
import { ScheduledMaintenanceCron } from './scheduled-maintenance.cron';

@Module({
  imports: [AdminSettingsModule],
  controllers: [
    ScheduledMaintenanceController,
    MaintenanceBannerController,
  ],
  providers: [ScheduledMaintenanceService, ScheduledMaintenanceCron],
  exports: [ScheduledMaintenanceService],
})
export class ScheduledMaintenanceModule {}
