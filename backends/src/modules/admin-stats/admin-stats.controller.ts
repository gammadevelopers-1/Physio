import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AdminStatsService } from './admin-stats.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminSecurityService } from './admin-security.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

// Admin stats endpoints are gated by JwtAuthGuard + RolesGuard and
// fired in tight bursts (the dashboard alone fans out into ~10 parallel
// calls). The per-IP throttle would otherwise trip on every refresh.
@SkipThrottle()
@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
export class AdminStatsController {
  constructor(
    private readonly adminStatsService: AdminStatsService,
    private readonly dashboardService: AdminDashboardService,
    private readonly securityService: AdminSecurityService,
  ) {}

  @Get('overview')
  async getOverview() {
    return this.adminStatsService.getOverview();
  }

  @Get('dashboard')
  async getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getDashboard(user);
  }

  @Get('security/sessions')
  async getSecuritySessions(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.securityService.listSessions({
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('security/failed-logins')
  async getFailedLogins(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('hours') hours?: string,
  ) {
    return this.securityService.listFailedLogins({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      hours: hours ? parseInt(hours, 10) : undefined,
    });
  }

  @Get('security/suspicious-ips')
  async getSuspiciousIps(@Query('threshold') threshold?: string) {
    return this.securityService.listSuspiciousIps(
      threshold ? parseInt(threshold, 10) : undefined,
    );
  }

  @Get('instructors-list')
  async getInstructorsList() {
    return this.adminStatsService.getInstructorsList();
  }

  @Get('managers-list')
  async getManagersList() {
    return this.adminStatsService.getManagersList();
  }
}
