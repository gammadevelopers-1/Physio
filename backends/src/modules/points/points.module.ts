import { Module } from '@nestjs/common';
import { PointsController } from './points.controller';
import { PointsAdminController } from './points-admin.controller';
import { PointsService } from './points.service';
import { PointsLedgerService } from './points-ledger.service';
import { PointsCronService } from './points.cron';
import { PointsSweepHoldsJob, PointsLogExpiredJob } from './points.jobs';
import { PointsReleaseHoldTask } from './points.tasks';
import { RewardsService } from './rewards/rewards.service';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

@Module({
  imports: [UserNotificationsModule, EnrollmentsModule],
  controllers: [PointsController, PointsAdminController],
  providers: [
    PointsService,
    PointsLedgerService,
    PointsCronService,
    PointsSweepHoldsJob,
    PointsLogExpiredJob,
    // Cloud Tasks handler — self-registers with TaskHandlerRegistry.
    PointsReleaseHoldTask,
    RewardsService,
  ],
  exports: [PointsService, PointsLedgerService, RewardsService],
})
export class PointsModule {}
