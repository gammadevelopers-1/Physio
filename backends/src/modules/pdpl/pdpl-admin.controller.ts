import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { PdplAdminService, PDPL_ACTIONS, PdplAction } from './pdpl-admin.service';

/**
 * `/admin/pdpl` — auditor-facing endpoints for the PDPL request ledger.
 * Same guard shape as /admin/stats so the same admin role can access it.
 */
@SkipThrottle()
@Controller('admin/pdpl')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
export class PdplAdminController {
  constructor(private readonly service: PdplAdminService) {}

  @Get('requests')
  async listRequests(
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (action && !PDPL_ACTIONS.includes(action as PdplAction)) {
      throw new BadRequestException(
        `Unknown PDPL action. Allowed: ${PDPL_ACTIONS.join(', ')}`,
      );
    }
    const parsedFrom = from ? new Date(from) : undefined;
    const parsedTo = to ? new Date(to) : undefined;
    if (parsedFrom && Number.isNaN(parsedFrom.getTime())) {
      throw new BadRequestException('`from` must be a valid ISO date');
    }
    if (parsedTo && Number.isNaN(parsedTo.getTime())) {
      throw new BadRequestException('`to` must be a valid ISO date');
    }
    return this.service.listRequests({
      action: action as PdplAction | undefined,
      userId: userId || undefined,
      from: parsedFrom,
      to: parsedTo,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('summary')
  async getSummary(@Query('days') days?: string) {
    const windowDays = Math.max(1, Math.min(365, Number(days ?? '30')));
    const to = new Date();
    const from = new Date(to.getTime() - windowDays * 24 * 60 * 60 * 1000);
    return this.service.getSummary(from, to);
  }
}
