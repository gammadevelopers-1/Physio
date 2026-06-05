import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { SlaMonitorService } from './sla-monitor.service';

@Module({
  imports: [AuthModule, UserNotificationsModule, NotificationsModule],
  controllers: [SupportController],
  providers: [SupportService, SlaMonitorService],
  exports: [SupportService],
})
export class SupportModule {}
