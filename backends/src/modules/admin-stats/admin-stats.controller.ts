import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminStatsService } from './admin-stats.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';

@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
export class AdminStatsController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  @Get('overview')
  async getOverview() {
    return this.adminStatsService.getOverview();
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
