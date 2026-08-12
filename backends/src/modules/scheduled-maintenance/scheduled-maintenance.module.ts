import { Module } from '@nestjs/common';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';
import {
  MaintenanceBannerController,
  ScheduledMaintenanceController,
} from './scheduled-maintenance.controller';
import { ScheduledMaintenanceService } from './scheduled-maintenance.service';
import { ScheduledMaintenanceCron } from './scheduled-maintenance.cron';
import { ScheduledMaintenanceTickJob } from './scheduled-maintenance.jobs';
import {
  MaintenanceActivateTask,
  MaintenanceCompleteTask,
  MaintenancePreNotifyTask,
} from './scheduled-maintenance.tasks';

@Module({
  imports: [AdminSettingsModule],
  controllers: [
    ScheduledMaintenanceController,
    MaintenanceBannerController,
  ],
  providers: [
    ScheduledMaintenanceService,
    ScheduledMaintenanceCron,
    // Legacy Cloud Run Job handler — retire in Phase 5.2 once event-
    // driven pipeline has run cleanly for 30 days.
    ScheduledMaintenanceTickJob,
    // Cloud Tasks handlers (event-driven replacement). Instantiated so
    // their constructors self-register with TaskHandlerRegistry.
    MaintenanceActivateTask,
    MaintenanceCompleteTask,
    MaintenancePreNotifyTask,
  ],
  exports: [ScheduledMaintenanceService],
})
export class ScheduledMaintenanceModule {}
