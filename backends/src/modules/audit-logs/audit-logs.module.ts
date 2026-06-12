import { Module, Global } from '@nestjs/common';
import { AuditLogService } from './audit-logs.service';
import { AuditLogController } from './audit-logs.controller';
import { AuthModule } from '../auth/auth.module';
import { RequestContextService } from '../../common/request-context.service';

// RequestContextService is exported so main.ts can grab the same
// instance for the middleware closure. The middleware needs to call
// `.run()` on the SAME service instance that AuditLogService reads
// from, or the store will be empty on read.
@Global()
@Module({
  imports: [AuthModule],
  controllers: [AuditLogController],
  providers: [AuditLogService, RequestContextService],
  exports: [AuditLogService, RequestContextService],
})
export class AuditLogModule {}
