import { Module } from '@nestjs/common';
import { AssessmentsController } from './assessments.controller';
import { AssessmentExtrasController } from './assessment-extras.controller';
import { AssessmentsService } from './assessments.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AssessmentsController, AssessmentExtrasController],
  providers: [AssessmentsService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
