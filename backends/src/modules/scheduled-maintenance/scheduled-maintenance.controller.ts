import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import type { UserRole } from '../../database/schema';
import { ScheduledMaintenanceService } from './scheduled-maintenance.service';
import { CreateScheduledMaintenanceDto } from './dto/create-scheduled-maintenance.dto';
import { UpdateScheduledMaintenanceDto } from './dto/update-scheduled-maintenance.dto';

@Controller('admin/maintenance/windows')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScheduledMaintenanceController {
  constructor(private readonly service: ScheduledMaintenanceService) {}

  private assertAdmin(user: AuthenticatedUser) {
    if (
      !user.roles.includes('ADMIN' as UserRole) &&
      !user.roles.includes('SUPER_ADMIN' as UserRole)
    ) {
      throw new ForbiddenException(
        'Only admins can manage scheduled maintenance',
      );
    }
  }

  @Get()
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    this.assertAdmin(user);
    const allowed = ['scheduled', 'active', 'completed', 'cancelled'];
    return this.service.list({
      status: allowed.includes(status ?? '')
        ? (status as 'scheduled' | 'active' | 'completed' | 'cancelled')
        : undefined,
    });
  }

  @Get('next-upcoming')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async nextUpcoming(@CurrentUser() user: AuthenticatedUser) {
    this.assertAdmin(user);
    return this.service.getNextUpcoming();
  }

  @Post()
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateScheduledMaintenanceDto,
  ) {
    this.assertAdmin(user);
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateScheduledMaintenanceDto,
  ) {
    this.assertAdmin(user);
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    this.assertAdmin(user);
    return this.service.cancel(id);
  }
}

/**
 * Authenticated read endpoint used by the cross-dashboard banner —
 * any logged-in user can ask "is there a maintenance window I should
 * know about right now?". Returns at most one entry (active OR within
 * its lead window).
 */
@Controller('maintenance/banner')
@UseGuards(JwtAuthGuard)
export class MaintenanceBannerController {
  constructor(private readonly service: ScheduledMaintenanceService) {}

  @Get()
  async current() {
    return this.service.getCurrentBannerWindow();
  }
}
