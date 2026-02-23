import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditLogService } from './audit-logs.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogController {
  constructor(private auditLogService: AuditLogService) {}

  /**
   * GET /audit-logs?entityType=session&entityId=xxx&page=1&limit=20
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Get()
  async getByEntity(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLogService.getByEntity(
      entityType,
      entityId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
