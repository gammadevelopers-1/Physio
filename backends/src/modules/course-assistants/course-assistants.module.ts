import { Module } from '@nestjs/common';
import { CourseAssistantsController } from './course-assistants.controller';
import { TACoursesController } from './ta-courses.controller';
import { CourseAssistantsService } from './course-assistants.service';
import { ThresholdEvaluationService } from './threshold-evaluation.service';
import { TaDeactivationCronService } from './ta-deactivation.cron';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';

@Module({
  imports: [UserNotificationsModule, AdminSettingsModule],
  controllers: [CourseAssistantsController, TACoursesController],
  providers: [
    CourseAssistantsService,
    ThresholdEvaluationService,
    TaDeactivationCronService,
  ],
  exports: [CourseAssistantsService, ThresholdEvaluationService],
})
export class CourseAssistantsModule {}
