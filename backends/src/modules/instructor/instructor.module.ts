import { Module } from '@nestjs/common';
import { InstructorController } from './instructor.controller';
import { InstructorService } from './instructor.service';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { SessionsModule } from '../sessions/sessions.module';
import { CertificatesModule } from '../certificates/certificates.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';

@Module({
  imports: [AuthModule, CoursesModule, SessionsModule, CertificatesModule, UserNotificationsModule],
  controllers: [InstructorController],
  providers: [InstructorService],
  exports: [InstructorService],
})
export class InstructorModule {}
