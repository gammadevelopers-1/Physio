import { Module } from '@nestjs/common';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { AuthModule } from '../auth/auth.module';
import { SessionAssistantsModule } from '../session-assistants/session-assistants.module';

@Module({
  imports: [AuthModule, SessionAssistantsModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
