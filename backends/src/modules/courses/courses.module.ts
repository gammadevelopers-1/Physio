import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { CourseCompletionCronService } from './course-completion.cron';
import { AuthModule } from '../auth/auth.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { CertificatesModule } from '../certificates/certificates.module';
import { PointsModule } from '../points/points.module';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';

@Module({
  imports: [AuthModule, UserNotificationsModule, CertificatesModule, PointsModule, AdminSettingsModule],
  controllers: [CoursesController],
  providers: [CoursesService, CourseCompletionCronService],
  exports: [CoursesService],
})
export class CoursesModule {}
