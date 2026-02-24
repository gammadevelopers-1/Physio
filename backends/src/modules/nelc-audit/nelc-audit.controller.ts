import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { NelcAuditService } from './nelc-audit.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';

@Controller('nelc-audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NelcAuditController {
  constructor(private readonly auditService: NelcAuditService) {}

  /**
   * GET /nelc-audit — Paginated, filterable audit logs (ADMIN only)
   */
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get()
  async query(
    @Query('eventType') eventType?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.query({
      eventType,
      entityType,
      entityId,
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /nelc-audit/summary — Aggregated counts by event type for date range (ADMIN only)
   */
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('summary')
  async getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const now = new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1); // Default: start of current month
    const end = endDate ? new Date(endDate) : now;

    return this.auditService.getSummary(start, end);
  }

  /**
   * GET /nelc-audit/export — Export audit logs as CSV download (ADMIN only)
   */
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('export')
  async exportLogs(
    @Query('eventType') eventType?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const result = await this.auditService.exportCsv({
      eventType,
      entityType,
      entityId,
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    res!.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });

    return new StreamableFile(result.buffer);
  }
}
