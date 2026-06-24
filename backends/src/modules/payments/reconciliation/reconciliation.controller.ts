import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ReconciliationService } from './reconciliation.service';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';

/**
 * Finance-only reconciliation API. Drift between our payments table and the
 * gateways' own records is surfaced here so finance can resolve / ignore
 * each finding manually. Scans can be triggered ad-hoc from the UI; a daily
 * cron will be wired up in Phase 3.
 */
@Controller('payments/reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
export class ReconciliationController {
  constructor(
    private readonly service: ReconciliationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('stats')
  async getStats() {
    return this.service.getStats();
  }

  @Get('findings')
  async listFindings(
    @Query('status') status?: 'unresolved' | 'resolved' | 'ignored' | 'all',
    @Query('gateway') gateway?: string,
    @Query('driftType') driftType?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.service.listFindings({
      status, gateway, driftType, fromDate, toDate, page, limit,
    });
  }

  /**
   * CSV / XLSX / PDF export of the current findings view. Honours the same
   * filters as listFindings; caps at 5000 rows. Rendered through the shared
   * FinanceService export pipeline so styling matches Reports-page exports.
   */
  @Get('findings/export')
  async exportFindings(
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @Query('format') format?: string,
    @Query('status') status?: 'unresolved' | 'resolved' | 'ignored' | 'all',
    @Query('gateway') gateway?: string,
    @Query('driftType') driftType?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const safeFormat = (['csv', 'xlsx', 'pdf'] as const).includes(format as any)
      ? (format as 'csv' | 'xlsx' | 'pdf')
      : 'csv';
    const result = await this.service.exportFindings({
      format: safeFormat,
      status,
      gateway,
      driftType,
      fromDate,
      toDate,
      user,
    });

    // Self-audit the export. Reconciliation evidence leaving the system
    // needs a trail for compliance — who, when, with what filters.
    await this.auditLogService.log({
      entityType: 'report_export',
      entityId: `reconciliation-findings-${new Date().toISOString().split('T')[0]}-${safeFormat}`,
      action: 'report_exported',
      performedBy: user.id,
      metadata: {
        report: 'reconciliation_findings',
        format: safeFormat,
        filters: { status, gateway, driftType, fromDate, toDate },
      },
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.body);
  }

  /**
   * Trigger a scan on demand. Defaults to the last 7 days for `moyasar`.
   * Rate-limited to 5/min to prevent accidental hammer-clicking from running
   * many concurrent paginated fetches or per-payment refetch sweeps.
   */
  @Post('scan')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async runScan(
    @Body()
    body: {
      gateway?: 'moyasar' | 'tamara' | 'tabby' | 'bank_transfer' | 'all';
      fromDate?: string;
      toDate?: string;
    } = {},
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const to = body.toDate ? new Date(body.toDate) : new Date();
    const from = body.fromDate
      ? new Date(body.fromDate)
      : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    return this.service.runScan({
      gateway: body.gateway || 'moyasar',
      fromDate: from,
      toDate: to,
      triggeredBy: user.id,
    });
  }

  @Patch('findings/:id/resolve')
  async resolve(
    @Param('id') findingId: string,
    @Body() body: { note?: string } = {},
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ip =
      req.ip ||
      (req.connection as { remoteAddress?: string } | undefined)?.remoteAddress ||
      'unknown';
    return this.service.resolveFinding(findingId, user, body.note, ip);
  }

  @Patch('findings/:id/ignore')
  async ignore(
    @Param('id') findingId: string,
    @Body() body: { note?: string } = {},
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ip =
      req.ip ||
      (req.connection as { remoteAddress?: string } | undefined)?.remoteAddress ||
      'unknown';
    return this.service.ignoreFinding(findingId, user, body.note, ip);
  }

  // ─── Bulk operations ────────────────────────────────────────────────
  // Single shared note across all selected findings (confirmed product
  // choice — per-finding notes defeat the point of bulk for the common
  // "triaging sandbox noise" workflow). Already-handled findings are
  // skipped silently and reported in the response so the UI can show
  // "resolved 27 of 30 selected".

  @Patch('findings/bulk-resolve')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async bulkResolve(
    @Body() body: { ids: string[]; note?: string },
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ip =
      req.ip ||
      (req.connection as { remoteAddress?: string } | undefined)?.remoteAddress ||
      'unknown';
    return this.service.bulkTransition({
      ids: body?.ids || [],
      op: 'resolve',
      note: body?.note,
      user,
      ipAddress: ip,
    });
  }

  @Patch('findings/bulk-ignore')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async bulkIgnore(
    @Body() body: { ids: string[]; note?: string },
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ip =
      req.ip ||
      (req.connection as { remoteAddress?: string } | undefined)?.remoteAddress ||
      'unknown';
    return this.service.bulkTransition({
      ids: body?.ids || [],
      op: 'ignore',
      note: body?.note,
      user,
      ipAddress: ip,
    });
  }
}
