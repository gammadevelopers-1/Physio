import { Module } from '@nestjs/common';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsService } from './admin-stats.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { NelcComplianceModule } from '../nelc-compliance/nelc-compliance.module';

@Module({
  imports: [NelcComplianceModule],
  controllers: [AdminStatsController],
  providers: [AdminStatsService, AdminDashboardService],
  exports: [AdminStatsService],
})
export class AdminStatsModule {}
