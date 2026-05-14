import { Module } from '@nestjs/common';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { AuthModule } from '../auth/auth.module';
import { CertificatesModule } from '../certificates/certificates.module';
import { StorageModule } from '../storage/storage.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { CourseAssistantsModule } from '../course-assistants/course-assistants.module';

@Module({
  imports: [
    AuthModule,
    CertificatesModule,
    StorageModule,
    UserNotificationsModule,
    CourseAssistantsModule,
  ],
  controllers: [StudentController],
  providers: [StudentService],
  exports: [StudentService],
})
export class StudentModule {}
