import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { MonitoringService } from './monitoring.service';

/**
 * `/admin/monitoring/*` — admin-only infrastructure health endpoints.
 *
 * Consumed by the frontend "Monitoring" page. All endpoints are
 * cached at the service layer (60s TTL) so refreshing the page a lot
 * doesn't fan out into Monitoring API cost.
 */
@SkipThrottle()
@Controller('admin/monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
export class MonitoringController {
  constructor(private readonly service: MonitoringService) {}

  @Get('services-health')
  async servicesHealth() {
    return this.service.servicesHealth();
  }

  @Get('jobs-stats')
  async jobsStats(@Query('hours') hours?: string) {
    const h = Math.max(1, Math.min(168, Number(hours ?? '24')));
    return this.service.jobsStats(h);
  }

  @Get('cloudsql')
  async cloudSql() {
    return this.service.cloudSqlMetrics();
  }

  @Get('redis')
  async redis() {
    return this.service.redisMetrics();
  }

  @Get('buckets')
  async buckets() {
    return this.service.bucketSizes();
  }

  @Get('uptime')
  async uptime() {
    return this.service.uptimeStatus();
  }
}
