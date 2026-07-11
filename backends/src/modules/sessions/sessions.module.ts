import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionReminderService } from './session-reminder.service';
import { SessionNotificationService } from './session-notification.service';
import { ZoomSyncService } from '../zoom/zoom-sync.service';
import {
  SessionReminderNotifyJob,
  SessionMarkMissedJob,
  SessionEndExpiredJob,
} from './sessions.jobs';
import { AuthModule } from '../auth/auth.module';
import { ZoomModule } from '../zoom/zoom.module';
import { SessionAssistantsModule } from '../session-assistants/session-assistants.module';
import { CourseAssistantsModule } from '../course-assistants/course-assistants.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';

@Module({
  imports: [AuthModule, ZoomModule, SessionAssistantsModule, CourseAssistantsModule, UserNotificationsModule, AdminSettingsModule],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    SessionReminderService,
    SessionNotificationService,
    ZoomSyncService,
    SessionReminderNotifyJob,
    SessionMarkMissedJob,
    SessionEndExpiredJob,
  ],
  exports: [SessionsService],
})
export class SessionsModule {}
