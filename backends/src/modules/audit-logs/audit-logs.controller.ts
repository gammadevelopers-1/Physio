import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuditLogService } from './audit-logs.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogController {
  constructor(private auditLogService: AuditLogService) {}

  /**
   * GET /audit-logs/finance/filters — distinct entity types and actions for dropdowns
   */
  @Roles('FINANCE' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('finance/filters')
  async getFilterOptions() {
    return this.auditLogService.getFilterOptions();
  }

  /**
   * GET /audit-logs/finance/export — NELC-compliant CSV/PDF export
   */
  @Roles('FINANCE' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('finance/export')
  async exportAuditLogs(
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @Query('format') format?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    const filters = { entityType, action, startDate, endDate, search };
    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'pdf') {
      const buffer = await this.auditLogService.exportAuditPdf(filters, user.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="audit-trail-${dateStr}.pdf"`);
      return res.send(buffer);
    }

    const csv = await this.auditLogService.exportAuditCsv(filters, user.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-trail-${dateStr}.csv"`);
    return res.send(csv);
  }

  /**
   * GET /audit-logs/finance — paginated list with rich filters
   */
  @Roles('FINANCE' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('finance')
  async getFinanceAuditLogs(
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLogService.findAllFinance(
      { entityType, action, startDate, endDate, search },
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * GET /audit-logs?entityType=X&entityId=Y&page=1&limit=20 — legacy per-entity lookup
   */
  @Roles('FINANCE' as UserRole, 'MANAGER' as UserRole, 'ADMIN' as UserRole)
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
