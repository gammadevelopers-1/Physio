import { Module } from '@nestjs/common';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';
import { FilesBackupService } from './files-backup.service';
import { FileRecoveryService } from './file-recovery.service';
import { WebsiteRecoveryController } from './website-recovery.controller';
import { WebsiteRecoveryService } from './website-recovery.service';
import { RestoreCloneService } from './restore-clone.service';
import { BackupsPurgeClonesJob } from './backups.jobs';
import { BackupPurgeCloneTask } from './backups.tasks';
import { AuthModule } from '../auth/auth.module';
import { MaterialsModule } from '../materials/materials.module';
import { CoursesModule } from '../courses/courses.module';

// AuditLogService is provided by the @Global AuditLogModule, so it can be
// injected here without importing that module explicitly.
// MaterialsModule + CoursesModule are imported so the admin Backups tab
// can call into them for the "Recently deleted" recovery features.
@Module({
  imports: [AuthModule, MaterialsModule, CoursesModule],
  controllers: [BackupsController, WebsiteRecoveryController],
  providers: [
    BackupsService,
    FilesBackupService,
    FileRecoveryService,
    WebsiteRecoveryService,
    RestoreCloneService,
    BackupsPurgeClonesJob,
    // Cloud Tasks handler — self-registers with TaskHandlerRegistry
    BackupPurgeCloneTask,
  ],
})
export class BackupsModule {}
