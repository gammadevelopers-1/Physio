import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionReminderService } from './session-reminder.service';
import { ZoomSyncService } from '../zoom/zoom-sync.service';
import { AuthModule } from '../auth/auth.module';
import { ZoomModule } from '../zoom/zoom.module';
import { SessionAssistantsModule } from '../session-assistants/session-assistants.module';

@Module({
  imports: [AuthModule, ZoomModule, SessionAssistantsModule],
  controllers: [SessionsController],
  providers: [SessionsService, SessionReminderService, ZoomSyncService],
  exports: [SessionsService],
})
export class SessionsModule {}
