import { Module } from '@nestjs/common';
import { NelcComplianceService } from './nelc-compliance.service';
import { NelcComplianceController } from './nelc-compliance.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [NelcComplianceController],
  providers: [NelcComplianceService],
  exports: [NelcComplianceService],
})
export class NelcComplianceModule {}
