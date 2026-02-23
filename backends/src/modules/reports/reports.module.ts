import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportSchedulerService } from './report-scheduler.service';
import { AuthModule } from '../auth/auth.module';
import { NelcComplianceModule } from '../nelc-compliance/nelc-compliance.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [AuthModule, NelcComplianceModule, EmailModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportSchedulerService],
})
export class ReportsModule {}
