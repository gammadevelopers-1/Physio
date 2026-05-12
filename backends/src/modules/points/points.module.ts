import { Module } from '@nestjs/common';
import { PointsController } from './points.controller';
import { PointsAdminController } from './points-admin.controller';
import { PointsService } from './points.service';
import { PointsLedgerService } from './points-ledger.service';
import { PointsCronService } from './points.cron';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

@Module({
  imports: [UserNotificationsModule, EnrollmentsModule],
  controllers: [PointsController, PointsAdminController],
  providers: [PointsService, PointsLedgerService, PointsCronService],
  exports: [PointsService, PointsLedgerService],
})
export class PointsModule {}
