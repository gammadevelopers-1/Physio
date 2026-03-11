import { Module } from '@nestjs/common';
import { CourseAssistantsController } from './course-assistants.controller';
import { CourseAssistantsService } from './course-assistants.service';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';

@Module({
  imports: [UserNotificationsModule],
  controllers: [CourseAssistantsController],
  providers: [CourseAssistantsService],
  exports: [CourseAssistantsService],
})
export class CourseAssistantsModule {}
