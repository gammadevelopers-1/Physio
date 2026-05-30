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
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

interface RestoreFileBody {
  bucketLabel?: string;
  name?: string;
  generation?: string;
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

  @Post(':id/download')
  getDownloadUrl(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.backups.getDownloadUrl(id, user.id, req.ip);
  }
}
