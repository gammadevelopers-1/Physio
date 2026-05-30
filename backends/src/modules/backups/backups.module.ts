import { Module } from '@nestjs/common';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';
import { FilesBackupService } from './files-backup.service';
import { WebsiteRecoveryController } from './website-recovery.controller';
import { WebsiteRecoveryService } from './website-recovery.service';
import { AuthModule } from '../auth/auth.module';

// AuditLogService is provided by the @Global AuditLogModule, so it can be
// injected here without importing that module explicitly.
@Module({
  imports: [AuthModule],
  controllers: [BackupsController, WebsiteRecoveryController],
  providers: [BackupsService, FilesBackupService, WebsiteRecoveryService],
})
export class BackupsModule {}
