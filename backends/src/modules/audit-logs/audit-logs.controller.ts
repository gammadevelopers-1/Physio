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

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogController {
  constructor(private auditLogService: AuditLogService) {}

  /**
   * GET /audit-logs?entityType=session&entityId=xxx&page=1&limit=20
   * Manager/admin: scoped to a specific entity (e.g. "show me the
   * audit trail for THIS course"). Used by per-entity drawers.
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
