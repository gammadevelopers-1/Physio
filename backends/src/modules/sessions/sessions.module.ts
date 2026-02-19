import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionReminderService } from './session-reminder.service';
import { AuthModule } from '../auth/auth.module';
import { ZoomModule } from '../zoom/zoom.module';

@Module({
  imports: [AuthModule, ZoomModule],
  controllers: [SessionsController],
  providers: [SessionsService, SessionReminderService],
  exports: [SessionsService],
})
export class SessionsModule {}
