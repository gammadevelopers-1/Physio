import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { ZoomSyncService } from '../zoom/zoom-sync.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { CancelSessionDto } from './dto/cancel-session.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsController {
  constructor(
    private sessionsService: SessionsService,
    private zoomSyncService: ZoomSyncService,
  ) {}

  // ─── Session Endpoints ──────────────────────────────────────

  /**
   * POST /sessions — Schedule a new session
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSessionDto,
  ) {
    return this.sessionsService.create(user, dto);
  }

  /**
   * GET /sessions — List sessions with filters
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('dateRange') dateRange?: string,
    @Query('status') status?: string,
    @Query('courseId') courseId?: string,
    @Query('instructorId') instructorId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.sessionsService.findAll(user, {
      dateRange,
      status,
      courseId,
      instructorId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * GET /sessions/conflicts — Detect scheduling conflicts across instructors
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Get('conflicts')
  async detectConflicts() {
    return this.sessionsService.detectConflicts();
  }

  /**
   * GET /sessions/today — Today's sessions
   * NOTE: Must be defined BEFORE :id route to avoid "today" matching as :id
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('today')
  async findToday(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.findToday(user);
  }

  /**
   * GET /sessions/upcoming — Future sessions ordered by date
   * NOTE: Must be defined BEFORE :id route to avoid "upcoming" matching as :id
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get('upcoming')
  async findUpcoming(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.findUpcoming(user);
  }

  /**
   * GET /sessions/instructor-load/:instructorId — Get instructor's weekly load
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Get('instructor-load/:instructorId')
  async getInstructorLoad(
    @Param('instructorId') instructorId: string,
    @Query('weekStart') weekStart?: string,
  ) {
    return this.sessionsService.getInstructorLoad(instructorId, weekStart);
  }

  /**
   * GET /sessions/instructor-schedule/:instructorId — Get instructor's 2-week schedule
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Get('instructor-schedule/:instructorId')
  async getInstructorSchedule(
    @Param('instructorId') instructorId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.sessionsService.getInstructorSchedule(instructorId, startDate, endDate);
  }

  /**
   * GET /sessions/:id — Session detail
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.findOne(id, user);
  }

  /**
   * PATCH /sessions/:id — Update a session
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.sessionsService.update(id, user, dto);
  }

  // ─── Lifecycle Endpoints ────────────────────────────────────

  /**
   * POST /sessions/:id/start — Mark session as live
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Post(':id/start')
  async start(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.start(id, user);
  }

  /**
   * POST /sessions/:id/end — Mark session as completed
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Post(':id/end')
  async end(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.end(id, user);
  }

  /**
   * PATCH /sessions/:id/cancel — Cancel session with required reason
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Patch(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelSessionDto,
  ) {
    return this.sessionsService.cancel(id, user, dto);
  }

  /**
   * DELETE /sessions/:id — Delete a completed or cancelled session
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.delete(id, user);
  }

  // ─── Manager Oversight Actions ──────────────────────────────

  /**
   * POST /sessions/:id/cancel-on-behalf — Cancel a session on behalf of instructor
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Post(':id/cancel-on-behalf')
  async cancelOnBehalf(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { reason: string },
  ) {
    return this.sessionsService.cancelOnBehalf(id, user, body.reason);
  }

  /**
   * PATCH /sessions/:id/reschedule — Reschedule a session
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Patch(':id/reschedule')
  async reschedule(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { scheduledAt: string; durationMinutes?: number },
  ) {
    return this.sessionsService.reschedule(id, user, body.scheduledAt, body.durationMinutes);
  }

  /**
   * PATCH /sessions/:id/assign-substitute — Assign substitute instructor
   */
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  @Patch(':id/assign-substitute')
  async assignSubstitute(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { instructorId: string },
  ) {
    return this.sessionsService.assignSubstitute(id, user, body.instructorId);
  }

  // ─── Zoom Sync Endpoints ──────────────────────────────────

  /**
   * POST /sessions/:id/sync-zoom — Manually trigger Zoom attendance sync
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Post(':id/sync-zoom')
  async syncZoom(@Param('id') id: string) {
    const result = await this.zoomSyncService.syncSession(id);
    return { message: 'Zoom attendance synced', ...result };
  }

  /**
   * GET /sessions/:id/attendance-logs — Get granular join/leave logs for a session
   * Includes unmatched Zoom participants (studentId IS NULL)
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole)
  @Get(':id/attendance-logs')
  async getAttendanceLogs(@Param('id') id: string) {
    return this.sessionsService.getAttendanceLogs(id);
  }

  /**
   * GET /sessions/:id/recordings — Get session recordings (item #22)
   */
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'MANAGER' as UserRole, 'STUDENT' as UserRole)
  @Get(':id/recordings')
  async getRecordings(@Param('id') id: string) {
    return this.sessionsService.getRecordings(id);
  }
}
