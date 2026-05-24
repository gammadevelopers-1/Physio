import { Module } from '@nestjs/common';
import { AssessmentsController } from './assessments.controller';
import { AssessmentExtrasController } from './assessment-extras.controller';
import { AssessmentsService } from './assessments.service';
import { AuthModule } from '../auth/auth.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';
import { StorageModule } from '../storage/storage.module';
import { EmailModule } from '../email/email.module';
import { AdminSettingsModule } from '../admin-settings/admin-settings.module';

@Module({
  imports: [AuthModule, UserNotificationsModule, StorageModule, EmailModule, AdminSettingsModule],
  controllers: [AssessmentsController, AssessmentExtrasController],
  providers: [AssessmentsService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
