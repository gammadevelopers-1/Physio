import { Module, forwardRef } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { CourseCompletionCronService } from './course-completion.cron';
import { CoursesCompletionJob } from './courses.jobs';
import { AuthModule } from '../auth/auth.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { CertificatesModule } from '../certificates/certificates.module';
import { PointsModule } from '../points/points.module';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';
import { SessionsModule } from '../sessions/sessions.module';
import { PaymentsModule } from '../payments/payments.module';

// SessionsModule provides SessionsService.cancelUpcomingForCourse() which
// runs as a cascade when an admin soft-deletes a course. forwardRef in
// case any future change introduces a back-edge from sessions → courses.
//
// PaymentsModule exports RefundService — used by the Phase B cancel-course
// flow to auto-refund every paid enrolment. Wrapped in forwardRef because
// payments/reconciliation touches courses lookups too (no live cycle today
// but the guard is cheap).
@Module({
  imports: [
    AuthModule,
    UserNotificationsModule,
    CertificatesModule,
    PointsModule,
    AdminSettingsModule,
    forwardRef(() => SessionsModule),
    forwardRef(() => PaymentsModule),
  ],
  controllers: [CoursesController],
  providers: [CoursesService, CourseCompletionCronService, CoursesCompletionJob],
  exports: [CoursesService],
})
export class CoursesModule {}
