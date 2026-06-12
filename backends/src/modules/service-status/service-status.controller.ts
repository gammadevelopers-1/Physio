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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import type { UserRole } from '../../database/schema';
import { ServiceStatusService } from './service-status.service';
import {
  CreateIncidentDto,
  PostIncidentUpdateDto,
  UpdateComponentStatusDto,
} from './dto';

// ─── Public reads — anyone can hit /status, login or not ──────
//
// Mounted under /api/public/service-status so it lines up with the
// existing /api/public/maintenance-status endpoint. No auth — that's
// the whole point: users can check this when they can't log in.

@Public()
@Controller('public/service-status')
export class PublicServiceStatusController {
  constructor(private readonly service: ServiceStatusService) {}

  @Get()
  async getPublicStatus() {
    return this.service.getPublicStatus();
  }
}

// ─── Admin writes — gated to ADMIN / SUPER_ADMIN ──────────────
//
// Component flips + incident lifecycle. The public controller above
// is the ONLY read path students/anonymous users have; this admin
// controller is auth-only.

@Controller('admin/service-status')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceStatusController {
  constructor(private readonly service: ServiceStatusService) {}

  private assertAdmin(user: AuthenticatedUser) {
    if (
      !user.roles.includes('ADMIN' as UserRole) &&
      !user.roles.includes('SUPER_ADMIN' as UserRole)
    ) {
      throw new ForbiddenException(
        'Only admins can manage service status',
      );
    }
  }

  @Get('components')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async listComponents(@CurrentUser() user: AuthenticatedUser) {
    this.assertAdmin(user);
    return this.service.listComponentsForAdmin();
  }

  @Put('components/:key')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async updateComponent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: UpdateComponentStatusDto,
  ) {
    this.assertAdmin(user);
    return this.service.updateComponentStatus(key, user.id, dto);
  }

  // Drop the admin's pin and return the component to auto-check
  // control. Public page shows the auto state from the next tick
  // (and immediately if auto_status already exists in DB).
  @Post('components/:key/clear-override')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async clearComponentOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
  ) {
    this.assertAdmin(user);
    return this.service.clearManualOverride(key, user.id);
  }

  @Get('incidents')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async listIncidents(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    this.assertAdmin(user);
    const normalised: 'active' | 'resolved' | 'all' =
      status === 'active' ? 'active' : status === 'resolved' ? 'resolved' : 'all';
    return this.service.listIncidentsForAdmin({ status: normalised });
  }

  @Post('incidents')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async createIncident(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateIncidentDto,
  ) {
    this.assertAdmin(user);
    return this.service.createIncident(user.id, dto);
  }

  @Post('incidents/:id/updates')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async postIncidentUpdate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PostIncidentUpdateDto,
  ) {
    this.assertAdmin(user);
    return this.service.postIncidentUpdate(id, user.id, dto);
  }

  @Delete('incidents/:id')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async deleteIncident(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    this.assertAdmin(user);
    return this.service.deleteIncident(id);
  }
}
