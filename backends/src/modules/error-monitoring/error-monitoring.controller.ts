import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ErrorMonitoringPeriod,
  ErrorMonitoringService,
} from './error-monitoring.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';

/**
 * Admin-only read interface over the Sentry REST API.
 * Powers the Settings → Error Monitoring tab. Every state-changing
 * action is also written to Sentry (the source of truth), so no audit
 * log entry is duplicated here — Sentry's own activity feed serves as
 * the audit trail for issue mutations.
 */
@SkipThrottle()
@Controller('admin/error-monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
export class ErrorMonitoringController {
  constructor(private readonly errorMonitoring: ErrorMonitoringService) {}

  @Get('overview')
  getOverview() {
    return this.errorMonitoring.getOverview();
  }

  @Get('top')
  getTop(
    @Query('period') period?: string,
    @Query('limit') limit?: string,
  ) {
    return this.errorMonitoring.getTopIssues(
      this.parsePeriod(period),
      limit ? Math.max(1, Math.min(25, parseInt(limit, 10))) : 10,
    );
  }

  @Get('trend')
  getTrend(@Query('period') period?: string) {
    return this.errorMonitoring.getTrend(this.parsePeriod(period));
  }

  @Get('issue/:issueId')
  getIssue(@Param('issueId') issueId: string) {
    return this.errorMonitoring.getIssueDetail(issueId);
  }

  @Post('issue/:issueId/resolve')
  resolveIssue(@Param('issueId') issueId: string) {
    return this.errorMonitoring.resolveIssue(issueId);
  }

  private parsePeriod(value?: string): ErrorMonitoringPeriod {
    if (value === '24h' || value === '7d' || value === '30d') return value;
    return '7d';
  }
}
