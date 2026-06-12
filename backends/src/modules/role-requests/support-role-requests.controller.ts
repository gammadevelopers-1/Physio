import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { RoleRequestsService } from './role-requests.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';

/**
 * Support-facing read-only access to trainer applications.
 *
 * The admin controller (RoleRequestsController) owns the write side:
 * approve / reject / requestInfo / block-national-id. This controller
 * exposes ONLY read endpoints so support agents can answer applicant
 * questions ("did you receive my application?", "why was it
 * rejected?", "what's missing?") without needing admin access.
 *
 * The same SUPPORT role gates the new ticket-detail panel
 * (TrainerApplicationCard) — that lookup is handled inside the
 * support module, this controller covers the standalone pages.
 */
@SkipThrottle()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  'SUPPORT' as UserRole,
  'ADMIN' as UserRole,
  'SUPER_ADMIN' as UserRole,
)
@Controller('support/role-requests')
export class SupportRoleRequestsController {
  constructor(private readonly service: RoleRequestsService) {}

  // ───────────────────────────────────────────────────────────────
  // GET /support/role-requests
  // List with pagination + status filter + search by email/name.
  // ───────────────────────────────────────────────────────────────
  @Get()
  async list(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listForSupport({
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ───────────────────────────────────────────────────────────────
  // GET /support/role-requests/:id
  // Detail with full event timeline.
  // ───────────────────────────────────────────────────────────────
  @Get(':id')
  async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.getForSupport(id);
  }
}
