import { Module } from '@nestjs/common';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { AuthModule } from '../auth/auth.module';
import { SessionAssistantsModule } from '../session-assistants/session-assistants.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { CourseAssistantsModule } from '../course-assistants/course-assistants.module';
import { ZoomModule } from '../zoom/zoom.module';

@Module({
  imports: [AuthModule, SessionAssistantsModule, UserNotificationsModule, CourseAssistantsModule, ZoomModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
