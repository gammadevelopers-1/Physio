import { Module } from '@nestjs/common';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';
import { FilesBackupService } from './files-backup.service';
import { FileRecoveryService } from './file-recovery.service';
import { WebsiteRecoveryController } from './website-recovery.controller';
import { WebsiteRecoveryService } from './website-recovery.service';
import { RestoreCloneService } from './restore-clone.service';
import { AuthModule } from '../auth/auth.module';
import { MaterialsModule } from '../materials/materials.module';

// AuditLogService is provided by the @Global AuditLogModule, so it can be
// injected here without importing that module explicitly.
// MaterialsModule is imported so the admin Backups tab can call into
// MaterialsService for the "Recently deleted materials" feature.
@Module({
  imports: [AuthModule, MaterialsModule],
  controllers: [BackupsController, WebsiteRecoveryController],
  providers: [
    BackupsService,
    FilesBackupService,
    FileRecoveryService,
    WebsiteRecoveryService,
    RestoreCloneService,
  ],
})
export class BackupsModule {}
