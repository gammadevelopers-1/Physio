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

  /**
   * GET /audit-logs/admin/list — broad admin search across the whole
   * audit_logs table. Filters: entityType, action, performedBy, search
   * (matches performer name/email), from/to date range, pagination.
   */
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('admin/list')
  async listForAdmin(
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('performedBy') performedBy?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLogService.findAllAdmin({
      entityType,
      action,
      performedBy,
      search,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /audit-logs/admin/distinct — distinct entity types + actions.
   * Powers the filter dropdowns on the admin Logs page.
   */
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('admin/distinct')
  async getDistinctValues() {
    return this.auditLogService.getDistinctValues();
  }

  /**
   * GET /audit-logs/admin/export — CSV download of the same query the
   * admin Logs page renders. Honors all filters; hard-capped at 10k rows
   * to keep a single click from OOMing the dyno.
   */
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('admin/export')
  async exportForAdmin(
    @Query('entityType') entityType: string | undefined,
    @Query('action') action: string | undefined,
    @Query('performedBy') performedBy: string | undefined,
    @Query('search') search: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const { data } = await this.auditLogService.findAllAdmin({
      entityType,
      action,
      performedBy,
      search,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: 1,
      limit: 10000,
    });

    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const headers = [
      'Timestamp',
      'Entity Type',
      'Entity ID',
      'Action',
      'Performer',
      'Email',
      'IP Address',
      'Metadata',
    ];
    const lines: string[] = [headers.join(',')];
    for (const row of data) {
      const name =
        `${row.performerFirstName || ''} ${row.performerLastName || ''}`.trim() ||
        row.performerEmail;
      lines.push(
        [
          escape(new Date(row.createdAt).toISOString()),
          escape(row.entityType),
          escape(row.entityId),
          escape(row.action),
          escape(name),
          escape(row.performerEmail),
          escape(row.ipAddress),
          escape(row.metadata),
        ].join(','),
      );
    }
    const body = '﻿' + lines.join('\r\n') + '\r\n';

    const ts = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${ts}.csv"`);
    res.send(body);
  }
}
