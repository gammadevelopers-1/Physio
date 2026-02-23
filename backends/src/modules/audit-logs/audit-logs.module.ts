import { Module, Global } from '@nestjs/common';
import { AuditLogService } from './audit-logs.service';
import { AuditLogController } from './audit-logs.controller';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
