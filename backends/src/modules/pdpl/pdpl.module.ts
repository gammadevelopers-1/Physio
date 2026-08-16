import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { AuditLogModule } from '../audit-logs/audit-logs.module';
import { EmailModule } from '../email/email.module';
import { PdplAdminController } from './pdpl-admin.controller';
import { PdplAdminService } from './pdpl-admin.service';
import { RetentionService } from './retention.service';

@Module({
  imports: [
    TasksModule, // for DistributedLockService
    AuditLogModule, // for AuditLogService (inactive-user warn/delete audit trail)
    EmailModule, // for sendInactiveAccountWarning
  ],
  controllers: [PdplAdminController],
  providers: [RetentionService, PdplAdminService],
  exports: [RetentionService],
})
export class PdplModule {}
