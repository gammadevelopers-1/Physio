import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { RoleRequestsService } from './role-requests.service';
import { CreateRoleRequestDto } from './dto/create-role-request.dto';
import { ReviewRoleRequestDto } from './dto/review-role-request.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';

// All endpoints are gated by JwtAuthGuard; admin views fan out into
// multiple parallel calls per page load. Per-IP throttle was tripping
// the Instructor Applications page on the shared LB IP — skip here.
@SkipThrottle()
@Controller('role-requests')
export class RoleRequestsController {
  constructor(private roleRequestsService: RoleRequestsService) {}

  // ===========================================
  // POST /role-requests - Submit new application
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT' as UserRole)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRoleRequestDto,
  ) {
    return this.roleRequestsService.create(userId, dto);
  }

  // ===========================================
  // GET /role-requests/mine - My applications
  // ===========================================
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  async findMine(@CurrentUser('id') userId: string) {
    return this.roleRequestsService.findMine(userId);
  }

  // ===========================================
  // POST /role-requests/blocked-national-ids - Block a National ID
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Post('blocked-national-ids')
  @HttpCode(HttpStatus.CREATED)
  async blockNationalId(
    @CurrentUser('id') adminId: string,
    @Body() body: { nationalId: string; reason: string },
  ) {
    return this.roleRequestsService.blockNationalId(
      body.nationalId,
      body.reason,
      adminId,
    );
  }

  // ===========================================
  // GET /role-requests/blocked-national-ids - List blocked IDs
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get('blocked-national-ids')
  async getBlockedNationalIds() {
    return this.roleRequestsService.getBlockedNationalIds();
  }

  // ===========================================
  // DELETE /role-requests/blocked-national-ids/:nationalId - Unblock
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Delete('blocked-national-ids/:nationalId')
  async unblockNationalId(@Param('nationalId') nationalId: string) {
    return this.roleRequestsService.unblockNationalId(nationalId);
  }

  // ===========================================
  // GET /role-requests - Admin list (paginated)
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.roleRequestsService.findAll({
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
    });
  }

  // ===========================================
  // GET /role-requests/:id - Single request detail (with events)
  //
  // Admin detail view. Returns the full role_request plus its event
  // timeline so the review page can render history without a second
  // round-trip.
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const [request, events] = await Promise.all([
      this.roleRequestsService.findOne(id),
      this.roleRequestsService.getEvents(id),
    ]);
    return { ...request, events };
  }

  // ===========================================
  // PATCH /role-requests/:id/approve - Approve
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Patch(':id/approve')
  async approve(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ReviewRoleRequestDto,
  ) {
    return this.roleRequestsService.approve(id, adminId, dto);
  }

  // ===========================================
  // PATCH /role-requests/:id/reject - Reject
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ReviewRoleRequestDto,
  ) {
    return this.roleRequestsService.reject(id, adminId, dto);
  }

  // ===========================================
  // PATCH /role-requests/:id/request-info
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Patch(':id/request-info')
  async requestInfo(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ReviewRoleRequestDto,
  ) {
    return this.roleRequestsService.requestInfo(id, adminId, dto);
  }

  // ===========================================
  // PATCH /role-requests/:id - Resubmit (student)
  // ===========================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT' as UserRole)
  @Patch(':id')
  async resubmit(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRoleRequestDto,
  ) {
    return this.roleRequestsService.resubmit(id, userId, dto);
  }
}
