import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminStatsService } from './admin-stats.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
export class AdminStatsController {
  constructor(
    private readonly adminStatsService: AdminStatsService,
    private readonly dashboardService: AdminDashboardService,
  ) {}

  @Get('overview')
  async getOverview() {
    return this.adminStatsService.getOverview();
  }

  @Get('dashboard')
  async getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getDashboard(user);
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
