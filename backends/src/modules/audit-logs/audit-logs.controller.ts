import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuditLogService } from './audit-logs.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

function extractIp(req: Request): string {
  return (
    req.ip ||
    (req.connection as { remoteAddress?: string } | undefined)?.remoteAddress ||
    'unknown'
  );
}

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
   * GET /audit-logs/finance/actors — distinct humans who have performed any
   * finance-scoped action. Powers the Actor filter dropdown.
   */
  @Roles('FINANCE' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('finance/actors')
  async getFinanceActors() {
    return this.auditLogService.getFinanceActors();
  }

  /**
   * GET /audit-logs/finance/summary — KPI rollup for the page header.
   * Honours every list filter so the cards always reflect the active view.
   */
  @Roles('FINANCE' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('finance/summary')
  async getFinanceSummary(
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    return this.auditLogService.getFinanceSummary({
      entityType, action, actorId, startDate, endDate, search,
    });
  }

  /**
   * GET /audit-logs/finance/export — NELC-compliant XLSX / CSV / PDF export.
   *
   * Meta-audited: every successful export writes its own audit row
   * (entity type `audit_log_export`) so compliance can see who pulled the
   * audit trail, with what filters, from which IP.
   */
  @Roles('FINANCE' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('finance/export')
  async exportAuditLogs(
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Query('format') format?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    const filters = { entityType, action, actorId, startDate, endDate, search };
    const dateStr = new Date().toISOString().split('T')[0];
    const safeFormat = ['xlsx', 'pdf', 'csv'].includes(format || '') ? format! : 'csv';

    let body: Buffer | string;
    let contentType: string;
    let extension: string;
    if (safeFormat === 'xlsx') {
      body = await this.auditLogService.exportAuditXlsx(filters, user.id);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
    } else if (safeFormat === 'pdf') {
      body = await this.auditLogService.exportAuditPdf(filters, user.id);
      contentType = 'application/pdf';
      extension = 'pdf';
    } else {
      body = await this.auditLogService.exportAuditCsv(filters, user.id);
      contentType = 'text/csv; charset=utf-8';
      extension = 'csv';
    }

    // Self-audit the export. Failures here are non-fatal — the user still
    // gets their file, but a logger.error in AuditLogService.log will surface
    // the write failure for ops review.
    await this.auditLogService.log({
      entityType: 'audit_log_export',
      entityId: `export-${dateStr}-${safeFormat}`,
      action: 'audit_log_exported',
      performedBy: user.id,
      ipAddress: extractIp(req),
      metadata: {
        format: safeFormat,
        filters,
        rowEstimate: Buffer.isBuffer(body) ? body.length : body.length,
      },
    });

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-trail-${dateStr}.${extension}"`,
    );
    return res.send(body);
  }

  /**
   * GET /audit-logs/finance — paginated list with rich filters
   */
  @Roles('FINANCE' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('finance')
  async getFinanceAuditLogs(
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditLogService.findAllFinance(
      { entityType, action, actorId, startDate, endDate, search },
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
