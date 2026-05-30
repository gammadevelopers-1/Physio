import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { BackupsService } from './backups.service';
import { FilesBackupService } from './files-backup.service';
import { FileRecoveryService } from './file-recovery.service';
import { RestoreCloneService } from './restore-clone.service';
import { MaterialsService } from '../materials/materials.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

interface RestoreFileBody {
  bucketLabel?: string;
  name?: string;
  generation?: string;
}

interface CreateRestoreCloneBody {
  backupId?: string;
}

/**
 * Admin backup management. Read + create + download only — there is no
 * in-place restore endpoint by design (restore is a guarded
 * restore-to-clone operation handled outside the app). Gated to admins;
 * every state-changing action is written to the audit log by the service.
 */
@SkipThrottle()
@Controller('admin/backups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
export class BackupsController {
  constructor(
    private readonly backups: BackupsService,
    private readonly filesBackup: FilesBackupService,
    private readonly fileRecovery: FileRecoveryService,
    private readonly restoreClones: RestoreCloneService,
    private readonly materials: MaterialsService,
  ) {}

  @Get('overview')
  getOverview() {
    return this.backups.getOverview();
  }

  @Get()
  list() {
    return this.backups.list();
  }

  @Get('restore-points')
  listRestorePoints() {
    return this.backups.listRestorePoints();
  }

  @Get('audit')
  listAuditHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.backups.listAuditHistory(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('snapshot')
  createSnapshot(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.backups.createSnapshot(user.id, req.ip);
  }

  @Post('export')
  createExport(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.backups.createExport(user.id, req.ip);
  }

  @Post('files')
  createFilesExport(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.filesBackup.createFilesExport(user.id, req.ip);
  }

  @Get('files/deleted')
  listDeletedFiles(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.fileRecovery.listDeleted(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('files/restore')
  restoreFile(
    @Body() body: RestoreFileBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.fileRecovery.restore(
      body?.bucketLabel || '',
      body?.name || '',
      body?.generation || '',
      user.id,
      req.ip,
    );
  }

  // ── Course material recovery (UI-level restore) ────────────────
  //
  // /files/* is storage-only restore. /materials/* is the full-stack
  // restore: clears `deleted_at` on the courseMaterials row AND
  // restores every linked GCS object from soft-delete. After this
  // call, the material reappears in the instructor's content list
  // exactly where it was.

  @Get('materials/deleted')
  listDeletedMaterials(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.materials.listDeleted(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('materials/:id/restore')
  restoreMaterial(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.materials.restoreMaterial(id, user.id);
  }

  // ── Restore sandboxes (Phase 2D) ───────────────────────────────
  //
  // Restores a chosen backup export into a new database on the live
  // Cloud SQL instance so the admin can inspect it and extract rows
  // via Cloud SQL Studio. Sandbox auto-drops past `expiresAt`.

  @Get('restore-clones')
  listRestoreClones(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.restoreClones.list(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('restore-clones')
  createRestoreClone(
    @Body() body: CreateRestoreCloneBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.restoreClones.createFromBackup(
      body?.backupId || '',
      user.id,
      req.ip,
    );
  }

  @Post('restore-clones/:id/extend')
  extendRestoreClone(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.restoreClones.extend(id, user.id, req.ip);
  }

  @Post('restore-clones/:id/drop')
  dropRestoreClone(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.restoreClones.drop(id, user.id, req.ip);
  }

  @Post(':id/download')
  getDownloadUrl(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.backups.getDownloadUrl(id, user.id, req.ip);
  }
}
