import { forwardRef, Module } from '@nestjs/common';
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
import {
  SessionRemindTask,
  SessionWarn90Task,
  SessionEndTask,
  SessionMarkMissedTask,
} from './sessions.tasks';
import { AuthModule } from '../auth/auth.module';
import { ZoomModule } from '../zoom/zoom.module';
import { SessionAssistantsModule } from '../session-assistants/session-assistants.module';
import { CourseAssistantsModule } from '../course-assistants/course-assistants.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';

@Module({
  imports: [
    AuthModule,
    // forwardRef: ZoomModule → SessionsModule (webhook path enqueues
    // session tasks) creates a cycle; Nest resolves via forwardRef.
    forwardRef(() => ZoomModule),
    SessionAssistantsModule,
    // forwardRef: CourseAssistantsModule → ZoomModule → SessionsModule
    // is a second cycle path — loading order can enter SessionsModule
    // while CourseAssistantsModule is still being constructed, so
    // eager import resolves to undefined. Deferring via forwardRef
    // closes it.
    forwardRef(() => CourseAssistantsModule),
    UserNotificationsModule,
    AdminSettingsModule,
  ],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    SessionReminderService,
    SessionNotificationService,
    ZoomSyncService,
    SessionReminderNotifyJob,
    SessionMarkMissedJob,
    SessionEndExpiredJob,
    // Cloud Tasks handlers for the migrated event-driven pipeline.
    // Constructors self-register with TaskHandlerRegistry.
    SessionRemindTask,
    SessionWarn90Task,
    SessionEndTask,
    SessionMarkMissedTask,
  ],
  // Also export SessionReminderService so ZoomModule (via forwardRef)
  // can inject it into its webhook controller.
  exports: [SessionsService, SessionReminderService],
})
export class SessionsModule {}
