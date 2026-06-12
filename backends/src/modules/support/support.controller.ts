import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
  BadRequestException,
  Res,
  Header,
  Req,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles, Public } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import type { UserRole } from '../../database/schema';
import { SupportService } from './support.service';
import {
  CreateTicketDto,
  UpdateTicketDto,
  AddCommentDto,
  ListTicketsQueryDto,
  UpdateSlaPolicyDto,
  CreateTicketOnBehalfDto,
  CreateGuestTicketDto,
  CreateMacroDto,
  UpdateMacroDto,
  CreateKbArticleDto,
  UpdateKbArticleDto,
  RateTicketDto,
  EscalateTicketDto,
} from './dto';

// Date-from-query-string helper for report endpoints. Returns null
// when missing or unparseable so the service treats it as "no
// bound" rather than choking on bad input.
function parseReportDate(input?: string): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // ─── Create Ticket (any authenticated user) ─────────────

  @Post()
  async createTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTicketDto,
  ) {
    return this.supportService.createTicket(user.id, dto);
  }

  // ─── List Tickets (support/admin see all, others see own) ──

  @Get()
  async listTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTicketsQueryDto,
  ) {
    return this.supportService.listTickets(user, query);
  }

  // ─── My Tickets (caller's own) ──────────────────────────

  @Get('my-tickets')
  async getMyTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTicketsQueryDto,
  ) {
    // Force the query to the current user's tickets
    return this.supportService.listTickets(user, {
      ...query,
      assigneeId: undefined, // Override any assignee filter
    });
  }

  // ─── Rate Ticket (any requester — own resolved/closed ticket) ─
  // Role-agnostic CSAT — the requester rates their own ticket
  // regardless of platform role (student / instructor / finance /
  // course-manager / TA). Mirrors the legacy /student/tickets/:id/rate
  // endpoint but doesn't gate on @Roles('STUDENT').
  @Post(':id/rate')
  async rateTicket(
    @Param('id', new ParseUUIDPipe()) ticketId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RateTicketDto,
  ) {
    return this.supportService.rateOwnTicket(user.id, ticketId, dto.rating);
  }

  // ─── Get KPIs (support/admin only) ──────────────────────

  @Get('kpis')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getKPIs() {
    return this.supportService.getKPIs();
  }

  // ─── Recent Activity (scoped by sub-role) ──────────────
  // Supervisor + admin see queue-wide activity; agents see only their
  // own assigned tickets.

  @Get('activity')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : 20;
    const safeLimit = Number.isFinite(parsed) && parsed > 0 && parsed <= 100 ? parsed : 20;
    return this.supportService.getActivity(user, safeLimit);
  }

  // ─── Get Agents (support supervisor/admin only) ─────────

  @Get('agents')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getAgents() {
    return this.supportService.getAgents();
  }

  // ─── Guest Ticket (Login Issues Only — no auth) ────────

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } }) // 3 / min / IP — abuse-prone (no auth)
  @Post('guest')
  async createGuestTicket(@Body() dto: CreateGuestTicketDto) {
    return this.supportService.createGuestTicket(dto);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } }) // 30 / min / IP — guest polls for status
  @Get('track/:trackingToken')
  async getTicketByTrackingToken(
    @Param('trackingToken') token: string,
  ) {
    return this.supportService.getTicketByTrackingToken(token);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 / min / IP
  @Post('track/:trackingToken/reply')
  async addGuestReply(
    @Param('trackingToken') token: string,
    @Body() body: { message: string },
  ) {
    const trimmed = body.message?.trim();
    if (!trimmed) {
      throw new BadRequestException('Message is required');
    }
    // Cap matches the authenticated reply DTO + ticketReplies.message
    // column. Without this, a guest could drop a 10MB payload through
    // the unauthenticated endpoint.
    const MAX_REPLY_LENGTH = 5000;
    if (trimmed.length > MAX_REPLY_LENGTH) {
      throw new BadRequestException(
        `Message must be ${MAX_REPLY_LENGTH} characters or fewer`,
      );
    }
    return this.supportService.addGuestReply(token, trimmed);
  }

  // ─── SLA Breaches + Backlog ────────────────────────────

  @Get('sla/breaches')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getSlaBreaches() {
    return this.supportService.getSlaBreaches();
  }

  @Get('sla/backlog')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getSlaBacklog() {
    return this.supportService.getSlaBacklog();
  }

  // ─── Create Support Agent (Supervisor Only) ────────────

  @Post('agents')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async createAgent(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
    },
  ) {
    // Only supervisors can create agents (not agents themselves)
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException('Only supervisors can create agents');
    }
    return this.supportService.createAgent(dto);
  }

  // ─── Team Management (supervisor-scoped) ────────────────

  @Get('team/my')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getMyTeam(@CurrentUser() user: AuthenticatedUser) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only supervisors can view their team',
      );
    }
    return this.supportService.listMyTeam(user.id);
  }

  @Get('team/available-agents')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getAvailableAgents(@CurrentUser() user: AuthenticatedUser) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only supervisors can browse available agents',
      );
    }
    return this.supportService.listAvailableAgents(user.id);
  }

  @Get('team/members/:agentId')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getTeamMemberDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agentId', ParseUUIDPipe) agentId: string,
  ) {
    return this.supportService.getTeamMemberDetail(user, agentId);
  }

  @Delete('team/members/:agentId')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async removeTeamMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @Req() req: Request,
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only supervisors can remove their own team members',
      );
    }
    return this.supportService.removeMyTeamMember(
      user,
      agentId,
      req.ip || '',
    );
  }

  @Post('team/requests')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async createTeamRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      kind: 'add_existing' | 'add_new';
      candidateUserId?: string;
      candidateEmail?: string;
      candidateFirstName?: string;
      candidateLastName?: string;
      candidatePhone?: string;
      reason?: string;
    },
    @Req() req: Request,
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only supervisors can submit team requests',
      );
    }
    return this.supportService.createTeamRequest(user, dto, req.ip || '');
  }

  @Get('team/requests/mine')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async listMyTeamRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.supportService.listMyTeamRequests(user.id);
  }

  // Admin: review queue + decisions
  @Get('team/requests')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async listAllTeamRequests(@Query('status') status?: string) {
    return this.supportService.listTeamRequests({ status });
  }

  @Get('team/requests/pending-count')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getPendingTeamRequestCount() {
    return { count: await this.supportService.countPendingTeamRequests() };
  }

  @Post('team/requests/:id/decision')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async decideTeamRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: {
      decision: 'approve' | 'reject';
      reason?: string;
      tempPassword?: string;
    },
    @Req() req: Request,
  ) {
    if (!dto.decision || (dto.decision !== 'approve' && dto.decision !== 'reject')) {
      throw new BadRequestException('decision must be "approve" or "reject"');
    }
    return this.supportService.decideTeamRequest(
      user,
      id,
      dto.decision,
      { reason: dto.reason, tempPassword: dto.tempPassword },
      req.ip || '',
    );
  }

  // ─── Admin: active supervisors / orphan agents / reassignment ─

  // Used by Create User + Manage Roles modals to populate the
  // supervisor picker and by the orphans banner to populate the
  // target dropdown.
  @Get('team/active-supervisors')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async listActiveSupervisors() {
    return this.supportService.listActiveSupervisors();
  }

  // Surfaced on the admin Team Management page as a banner so any
  // agent without a supervisor (created before the no-orphan
  // invariant, or stranded after a supervisor was demoted via legacy
  // path) is visible and actionable.
  @Get('team/orphans')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async listOrphanAgents() {
    return this.supportService.listOrphanAgents();
  }

  @Post('team/orphans/bulk-assign')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async bulkAssignOrphans(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { supervisorId: string; agentIds: string[] },
    @Req() req: Request,
  ) {
    if (!dto?.supervisorId) {
      throw new BadRequestException('supervisorId is required');
    }
    return this.supportService.bulkAssignOrphansToSupervisor(
      user,
      dto.supervisorId,
      dto.agentIds || [],
      req.ip || '',
    );
  }

  @Post('team/reassign')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async reassignSupervisorTeam(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { fromSupervisorId: string; toSupervisorId: string },
    @Req() req: Request,
  ) {
    if (!dto?.fromSupervisorId || !dto?.toSupervisorId) {
      throw new BadRequestException(
        'fromSupervisorId and toSupervisorId are required',
      );
    }
    return this.supportService.reassignSupervisorTeam(
      user,
      dto.fromSupervisorId,
      dto.toSupervisorId,
      req.ip || '',
    );
  }

  // ─── Admin Support KPIs ────────────────────────────────

  @Get('admin/support-kpis')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getAdminSupportKpis() {
    return this.supportService.getAdminSupportKpis();
  }

  // Admin Support Overview — single-payload feed for the new Overview
  // tab on the admin dashboard. Returns the 7 client-requested metrics
  // (open / awaiting response / overdue / by priority / by category /
  // agent workload / CSAT) plus an at-risk list, recent-activity feed,
  // 7-day trend deltas, cron-health strip, and pending team-request
  // count. Read-only — no side-effects.
  @Get('admin/support-overview')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getSupportOverview(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.supportService.getSupportOverview(dateFrom, dateTo);
  }

  // Admin-only — list supervisors with team-aggregate performance
  // metrics scoped to an optional date range (7d, 30d, or custom).
  @Get('admin/supervisors')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async listSupervisorsWithStats(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.supportService.listSupervisorsWithStats(dateFrom, dateTo);
  }

  // Admin-only — supervisor detail bundle: profile + team agents (with
  // per-agent perf) + supervisor's own active tickets + aggregates.
  @Get('admin/supervisors/:id')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getSupervisorDetail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.supportService.getSupervisorDetail(id, dateFrom, dateTo);
  }

  // Admin-only — paginated support audit trail. Backs the "Audit trail"
  // section of the overview tab. Rolls up every meaningful ticket-side
  // mutation (created, replied, internal note, assignee/status/priority
  // changed, resolved, closed, reopened) along with the actor and their
  // role for display.
  @Get('admin/audit-trail')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getSupportAuditTrail(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.supportService.getSupportAuditTrail(
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
    );
  }

  // Same payload as the admin endpoint, but open to supervisors so the
  // supervisor alerts page can render cross-team activity. Agents are
  // intentionally excluded — they only see alerts on their own queue
  // via the existing /alerts page that reads from KPIs.
  @Get('audit-trail')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getSupportAuditTrailScoped(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // Reject support agents — only supervisors and admin-level roles
    // see this view. Without this an agent could call the endpoint
    // directly even though the FE never surfaces a button.
    const isSupervisor = user.supportSubRole === 'supervisor';
    const isAdmin =
      user.roles.includes('ADMIN' as UserRole) ||
      user.roles.includes('SUPER_ADMIN' as UserRole);
    if (!isSupervisor && !isAdmin) {
      throw new ForbiddenException(
        'Only supervisors and admins can view the support audit trail',
      );
    }
    return this.supportService.getSupportAuditTrail(
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
    );
  }

  // ─── Settings — Business Hours, Auto-Assignment, Categories, Notifs ──

  // Public read so the public ticket form can show "online/offline" hint.
  @Public()
  @Get('settings/business-hours')
  async getBusinessHours() {
    return this.supportService.getBusinessHours();
  }

  @Patch('settings/business-hours')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async setBusinessHours(
    @Body()
    dto: {
      workingDays?: number[];
      openTime?: string;
      closeTime?: string;
      timezoneOffsetHours?: number;
    },
  ) {
    return this.supportService.setBusinessHours(dto);
  }

  @Get('settings/auto-assignment')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getAutoAssignment() {
    return this.supportService.getAutoAssignment();
  }

  @Patch('settings/auto-assignment')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async setAutoAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      enabled?: boolean;
      strategy?: 'round_robin' | 'least_loaded' | 'manual';
      respectBusinessHours?: boolean;
      maxConcurrentPerAgent?: number;
    },
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only supervisors or admins can change auto-assignment settings',
      );
    }
    return this.supportService.setAutoAssignment(dto);
  }

  // Public read so the unauthenticated PublicTicketForm dropdown can
  // render admin-added categories. Mutations (POST/PATCH/DELETE below)
  // stay role-gated. The list only exposes slug + names + auto-priority
  // + applicableRoles — nothing sensitive.
  //
  // Optional ?role= filter narrows the list to categories that have
  // the given role in their applicableRoles array. Each customer
  // dashboard's Support inbox uses this to drive its create-ticket
  // dropdown without hardcoded slug lists.
  @Public()
  @Get('settings/ticket-categories')
  async listTicketCategories(@Query('role') role?: string) {
    return this.supportService.listTicketCategories(
      role ? { role } : undefined,
    );
  }

  @Post('settings/ticket-categories')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async addTicketCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      slug?: string;
      nameEn: string;
      nameAr?: string;
      autoPriority?: 'high' | 'medium' | 'low';
      applicableRoles?: string[];
    },
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only supervisors or admins can manage ticket categories',
      );
    }
    return this.supportService.addTicketCategory(dto);
  }

  @Patch('settings/ticket-categories/:slug')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async updateTicketCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
    @Body()
    dto: {
      nameEn?: string;
      nameAr?: string | null;
      autoPriority?: 'high' | 'medium' | 'low' | null;
      applicableRoles?: string[];
    },
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only supervisors or admins can manage ticket categories',
      );
    }
    return this.supportService.updateTicketCategory(slug, dto);
  }

  @Delete('settings/ticket-categories/:slug')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async removeTicketCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only supervisors or admins can manage ticket categories',
      );
    }
    return this.supportService.removeTicketCategory(slug);
  }

  @Get('settings/notification-prefs')
  async getMyNotificationPrefs(@CurrentUser() user: AuthenticatedUser) {
    return this.supportService.getSupportNotificationPrefs(user.id);
  }

  @Patch('settings/notification-prefs')
  async setMyNotificationPrefs(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: Record<string, boolean>,
  ) {
    return this.supportService.setSupportNotificationPrefs(user.id, dto);
  }

  // ─── Reports API ───────────────────────────────────────

  @Get('reports/trend')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getTicketTrend(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('interval') interval?: string,
  ) {
    const i: 'day' | 'week' = interval === 'week' ? 'week' : 'day';
    return this.supportService.getTicketTrend(dateFrom, dateTo, i);
  }

  @Get('reports/csat-comments')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getRecentCsatComments(@Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 10;
    return this.supportService.getRecentCsatComments(
      Number.isFinite(n) ? n : 10,
    );
  }

  @Get('reports/volume')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getVolumeReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.supportService.getVolumeReport(dateFrom, dateTo);
  }

  @Get('reports/issues')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getTopIssues(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.supportService.getTopIssues(dateFrom, dateTo);
  }

  @Get('reports/sla-compliance')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getSlaComplianceReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.supportService.getSlaComplianceReport(dateFrom, dateTo);
  }

  @Get('reports/agent-performance')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getAgentPerformance(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.supportService.getAgentPerformance(dateFrom, dateTo);
  }

  @Get('reports/export')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async exportReport(
    @Query('type') type: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.supportService.exportReport(type, dateFrom, dateTo);
  }

  @Get('reports/export-pdf')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async exportReportPdf(
    @Query('type') type: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Res() res?: Response,
  ) {
    const pdfBuffer = await this.supportService.exportReportPdf(
      type,
      dateFrom,
      dateTo,
    );
    const filename = `support_report_${type}_${new Date().toISOString().split('T')[0]}.pdf`;
    res!.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    res!.end(pdfBuffer);
  }

  // ─── Survey Summaries (Supervisor/Admin only) ──────────

  @Get('csat/summary')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getCsatSummary(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.supportService.getCsatSummary({
      dateFrom: parseReportDate(dateFrom),
      dateTo: parseReportDate(dateTo),
    });
  }

  @Get('csat/by-category')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getCsatByCategory(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.supportService.getCsatByCategory({
      dateFrom: parseReportDate(dateFrom),
      dateTo: parseReportDate(dateTo),
    });
  }

  @Get('csat/by-agent')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getCsatByAgent(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.supportService.getCsatByAgent({
      dateFrom: parseReportDate(dateFrom),
      dateTo: parseReportDate(dateTo),
    });
  }

  @Get('csat/monthly')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getCsatMonthly(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.supportService.getCsatMonthlyTrend({
      dateFrom: parseReportDate(dateFrom),
      dateTo: parseReportDate(dateTo),
    });
  }

  @Get('csat/low-ratings')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getLowRatingSurveys(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
  ) {
    const normalisedStatus: 'pending' | 'completed' | 'all' =
      status === 'pending' ? 'pending' : status === 'completed' ? 'completed' : 'all';
    return this.supportService.getLowRatingSurveys({
      dateFrom: parseReportDate(dateFrom),
      dateTo: parseReportDate(dateTo),
      status: normalisedStatus,
    });
  }

  @Post('csat/:surveyId/follow-up')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async markCsatFollowedUp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('surveyId', new ParseUUIDPipe()) surveyId: string,
  ) {
    // Supervisor / admin only — the panel that surfaces these surveys
    // is supervisor-gated in the FE, but defence-in-depth at the API
    // layer keeps lower-privilege roles from poking at the endpoint.
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes('ADMIN' as UserRole) ||
      user.roles.includes('SUPER_ADMIN' as UserRole);
    if (!isSupervisorOrAdmin) {
      throw new ForbiddenException(
        'Only supervisors can mark CSAT follow-ups',
      );
    }
    return this.supportService.markCsatFollowedUp(surveyId, user.id);
  }

  @Get('nps/summary')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getNpsSummary() {
    return this.supportService.getNpsSummary();
  }

  // ─── Macros CRUD (Support/Admin only) ───────────────────

  @Get('macros')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getMacros(
    @CurrentUser() user: AuthenticatedUser,
    @Query('categoryKey') categoryKey?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    // Only supervisors/admins may see inactive macros (so they can
    // restore them). Agents always get the active subset.
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes('ADMIN' as UserRole) ||
      user.roles.includes('SUPER_ADMIN' as UserRole);
    const wantInactive = includeInactive === 'true' && isSupervisorOrAdmin;
    return this.supportService.getMacros({
      categoryKey: categoryKey || null,
      includeInactive: wantInactive,
    });
  }

  @Get('macros/usage-stats')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getMacroUsageStats(@CurrentUser() user: AuthenticatedUser) {
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes('ADMIN' as UserRole) ||
      user.roles.includes('SUPER_ADMIN' as UserRole);
    if (!isSupervisorOrAdmin) {
      throw new ForbiddenException('Only supervisors can view macro analytics');
    }
    return this.supportService.getMacroUsageStats();
  }

  @Get('macros/:id')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getMacro(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.supportService.getMacro(id);
  }

  @Post('macros')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async createMacro(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMacroDto,
  ) {
    // Only supervisors and admins can create macros (agents get 403)
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN');
    if (!isSupervisorOrAdmin) {
      throw new ForbiddenException('Only supervisors can manage macros');
    }
    return this.supportService.createMacro(user.id, dto);
  }

  @Patch('macros/:id')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async updateMacro(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMacroDto,
  ) {
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN');
    if (!isSupervisorOrAdmin) {
      throw new ForbiddenException('Only supervisors can manage macros');
    }
    return this.supportService.updateMacro(id, dto);
  }

  @Delete('macros/:id')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async deleteMacro(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN');
    if (!isSupervisorOrAdmin) {
      throw new ForbiddenException('Only supervisors can manage macros');
    }
    return this.supportService.deleteMacro(id);
  }

  // ─── Knowledge Base (Public read, Admin write) ────────

  // ─── Help Center Categories CRUD ───────────────────────

  @Public()
  @Get('kb/categories')
  async listKbCategories() {
    return this.supportService.listKbCategories();
  }

  @Post('kb/categories')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async createKbCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      slug?: string;
      nameEn: string;
      nameAr?: string;
      icon?: string;
      sortOrder?: number;
    },
  ) {
    return this.supportService.createKbCategory(user.id, dto);
  }

  @Patch('kb/categories/:id')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async updateKbCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body()
    dto: {
      nameEn?: string;
      nameAr?: string;
      icon?: string;
      sortOrder?: number;
    },
  ) {
    return this.supportService.updateKbCategory(id, dto);
  }

  @Delete('kb/categories/:id')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async deleteKbCategory(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.supportService.deleteKbCategory(id);
  }

  @Public()
  @Get('kb/articles')
  async getKbArticles(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.supportService.getKbArticles({
      category,
      search,
      publishedOnly: true,
    });
  }

  @Public()
  @Get('kb/articles/:id')
  async getKbArticle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.supportService.getKbArticle(id, true);
  }

  @Post('kb/articles')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async createKbArticle(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateKbArticleDto,
  ) {
    return this.supportService.createKbArticle(user.id, dto);
  }

  @Patch('kb/articles/:id')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async updateKbArticle(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateKbArticleDto,
  ) {
    return this.supportService.updateKbArticle(id, dto);
  }

  @Delete('kb/articles/:id')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async deleteKbArticle(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.supportService.deleteKbArticle(id);
  }

  // ─── Retention policy (supervisor/admin) ───────────────

  @Get('config/retention')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getRetentionConfig() {
    const days = await this.supportService.getRetentionDays();
    return { retentionDays: days };
  }

  @Patch('config/retention')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async setRetentionConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { days: number },
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only supervisors can change retention policy',
      );
    }
    if (typeof body?.days !== 'number') {
      throw new BadRequestException('days must be a number');
    }
    return this.supportService.setRetentionDays(body.days);
  }

  // ─── KB Search Analytics ───────────────────────────────
  //
  // Log: throttled + public so guests on the help center are counted.
  // The current user (if any) is attached by reading it via the JWT
  // strategy; we don't gate on @Roles because the route is @Public.
  // Analytics read: supervisor/admin only.

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } }) // generous — debounced FE call
  @Post('kb/searches')
  async logKbSearch(
    @Req() req: Request,
    @Body() body: { query: string; locale?: string; resultsCount: number },
  ) {
    if (!body || typeof body.query !== 'string') {
      throw new BadRequestException('query is required');
    }
    // Pull the JWT user opportunistically. The guard didn't run because
    // we're @Public; if a token was present, it would have been attached
    // by an upstream interceptor — fall back to null.
    const userId = (req as any).user?.id ?? null;
    return this.supportService.logKbSearch({
      query: body.query,
      locale: body.locale ?? 'en',
      resultsCount: Number(body.resultsCount || 0),
      userId,
    });
  }

  @Get('kb/search-analytics')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getKbSearchAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limitStr?: string,
  ) {
    // Supervisors and admins only — agents don't see KB analytics
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException('Only supervisors can view KB analytics');
    }
    const limit = limitStr ? parseInt(limitStr, 10) : 25;
    return this.supportService.getKbSearchAnalytics(dateFrom, dateTo, limit);
  }

  @Get('kb/articles/analytics/most-viewed')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getMostViewedKbArticles(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limitStr?: string,
  ) {
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes('ADMIN' as UserRole) ||
      user.roles.includes('SUPER_ADMIN' as UserRole);
    if (!isSupervisorOrAdmin) {
      throw new ForbiddenException('Only supervisors can view KB analytics');
    }
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    return this.supportService.getMostViewedKbArticles({
      limit: Number.isFinite(limit) ? limit : 10,
    });
  }

  @Get('kb/articles/analytics/low-engagement')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getLowEngagementKbArticles(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limitStr?: string,
    @Query('minAgeDays') minAgeDaysStr?: string,
  ) {
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes('ADMIN' as UserRole) ||
      user.roles.includes('SUPER_ADMIN' as UserRole);
    if (!isSupervisorOrAdmin) {
      throw new ForbiddenException('Only supervisors can view KB analytics');
    }
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    const minAgeDays = minAgeDaysStr ? parseInt(minAgeDaysStr, 10) : 30;
    return this.supportService.getLowEngagementKbArticles({
      limit: Number.isFinite(limit) ? limit : 10,
      minAgeDays: Number.isFinite(minAgeDays) ? minAgeDays : 30,
    });
  }

  // ─── Ticket Tags ───────────────────────────────────────
  // The registry is read by any authenticated support user (agents need
  // it to render chips) but mutations are supervisor/admin-gated. The
  // per-ticket setter accepts the full desired tag set so the call is
  // idempotent — see service.setTicketTags for the diff logic.

  @Get('tags')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async listTicketTags(
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.supportService.listTicketTags({
      includeArchived: includeArchived === 'true' || includeArchived === '1',
    });
  }

  @Post('tags')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async createTicketTag(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: { name: string; color?: string; description?: string },
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException('Only supervisors can manage ticket tags');
    }
    return this.supportService.createTicketTag(user.id, dto);
  }

  @Patch('tags/:id')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async updateTicketTag(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { name?: string; color?: string; description?: string },
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException('Only supervisors can manage ticket tags');
    }
    return this.supportService.updateTicketTag(id, dto);
  }

  @Delete('tags/:id')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async deleteTicketTag(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException('Only supervisors can manage ticket tags');
    }
    return this.supportService.deleteTicketTag(id);
  }

  // ─── Archive / unarchive ──────────────────────────────────
  //
  // Soft archive — hides the tag from the picker + auto-apply matcher
  // but keeps assignments + history. The preferred path when a tag is
  // in active use; delete cascades and loses reporting context.

  @Post('tags/:id/archive')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async archiveTicketTag(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException('Only supervisors can manage ticket tags');
    }
    return this.supportService.archiveTicketTag(id);
  }

  @Post('tags/:id/unarchive')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async unarchiveTicketTag(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException('Only supervisors can manage ticket tags');
    }
    return this.supportService.unarchiveTicketTag(id);
  }

  // ─── Tag rules (auto-apply patterns) ──────────────────────

  @Get('tags/:id/rules')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async listTagRules(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException('Only supervisors can manage tag rules');
    }
    return this.supportService.listTagRules(id);
  }

  @Post('tags/:id/rules')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async createTagRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body()
    dto: {
      pattern: string;
      matchScope?: 'subject' | 'description' | 'both';
      enabled?: boolean;
    },
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException('Only supervisors can manage tag rules');
    }
    return this.supportService.createTagRule(user.id, id, dto);
  }

  @Patch('tag-rules/:ruleId')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async updateTagRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ruleId', new ParseUUIDPipe()) ruleId: string,
    @Body()
    dto: {
      pattern?: string;
      matchScope?: 'subject' | 'description' | 'both';
      enabled?: boolean;
    },
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException('Only supervisors can manage tag rules');
    }
    return this.supportService.updateTagRule(ruleId, dto);
  }

  @Delete('tag-rules/:ruleId')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async deleteTagRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ruleId', new ParseUUIDPipe()) ruleId: string,
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException('Only supervisors can manage tag rules');
    }
    return this.supportService.deleteTagRule(ruleId);
  }

  // ─── Tag analytics ────────────────────────────────────────

  @Get('tags/analytics/summary')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getTagAnalytics(@CurrentUser() user: AuthenticatedUser) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException('Only supervisors can view tag analytics');
    }
    return this.supportService.getTagAnalytics();
  }

  // PATCH because we replace the full tag set on the ticket — POST
  // would imply an append. Any agent on the ticket can change tags.
  @Patch(':id/tags')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async setTicketTags(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { tagIds: string[] },
  ) {
    if (!Array.isArray(dto?.tagIds)) {
      throw new BadRequestException('tagIds must be an array');
    }
    return this.supportService.setTicketTags(user, id, dto.tagIds);
  }

  // ─── CSAT Survey (Public — no auth required) ──────────

  // Pending CSAT prompts for the current user. Powers the global
  // dashboard popup that nudges the user to rate without forcing
  // them to dig into a resolved ticket. Returns at most 5 surveys
  // (most recent first) that are still within the 72h window and
  // not yet submitted. Auth-required because the response leaks
  // the user's recent resolved tickets.
  @Get('csat/pending')
  async getPendingCsatForUser(@CurrentUser() user: AuthenticatedUser) {
    return this.supportService.getPendingCsatForUser(user);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 / min / IP
  @Get('csat/:surveyId')
  async getCsatSurvey(
    @Param('surveyId', new ParseUUIDPipe()) surveyId: string,
  ) {
    return this.supportService.getCsatSurvey(surveyId);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 / min / IP — vote spam defense
  @Post('csat/:surveyId')
  async submitCsatScore(
    @Param('surveyId', new ParseUUIDPipe()) surveyId: string,
    @Body() body: { score: number; comment?: string },
  ) {
    if (!body.score || body.score < 1 || body.score > 5) {
      throw new BadRequestException('Score must be between 1 and 5');
    }
    return this.supportService.submitCsatScore(
      surveyId,
      body.score,
      body.comment,
    );
  }

  // ─── Create Ticket on Behalf (Instructor → Learner) ────

  @Post('on-behalf')
  @Roles('INSTRUCTOR' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async createTicketOnBehalf(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTicketOnBehalfDto,
  ) {
    return this.supportService.createTicketOnBehalf(user.id, dto);
  }

  // ─── Tickets Opened By Me ──────────────────────────────

  @Get('opened-by-me')
  async getTicketsOpenedByMe(@CurrentUser() user: AuthenticatedUser) {
    return this.supportService.getTicketsOpenedByMe(user.id);
  }

  // ─── Course Ticket Count ───────────────────────────────

  @Get('course/:courseId/count')
  async getCourseTicketCount(
    @Param('courseId', new ParseUUIDPipe()) courseId: string,
  ) {
    return this.supportService.getCourseTicketCount(courseId);
  }

  // ─── My Performance (per-user sidebar stats) ──────────
  // MUST be declared before `@Get(':id')` so Nest doesn't route
  // `/tickets/my-performance` through the UUID handler. Returns the
  // logged-in agent/supervisor's resolved count, avg FRT, and CSAT avg.

  @Get('my-performance')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getMyPerformance(@CurrentUser() user: AuthenticatedUser) {
    return this.supportService.getMyPerformance(user.id);
  }

  // ─── SLA Policy Endpoints ──────────────────────────────
  // NOTE: These MUST be declared before `@Get(':id')` below, otherwise
  // NestJS matches `/tickets/sla-policies` against the UUID route first
  // and ParseUUIDPipe throws 400. Same applies to any future literal paths.

  @Get('sla-policies')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getSlaPolicies() {
    return this.supportService.getSlaPolicies();
  }

  @Put('sla-policies/:priority')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async updateSlaPolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('priority') priority: string,
    @Body() dto: UpdateSlaPolicyDto,
  ) {
    // Batch 6.2: validate priority path param up front
    const ALLOWED_PRIORITIES = ['high', 'medium', 'low'];
    if (!ALLOWED_PRIORITIES.includes(priority)) {
      throw new BadRequestException(
        `Invalid priority "${priority}". Must be one of: ${ALLOWED_PRIORITIES.join(', ')}`,
      );
    }

    // Only supervisors and admins can update (SA-05: agents get 403)
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN');

    if (!isSupervisorOrAdmin) {
      throw new ForbiddenException(
        'Only supervisors can update SLA policies',
      );
    }

    return this.supportService.updateSlaPolicy(priority, dto);
  }

  // ─── Per-ticket history export (CSV) ───────────────────
  //
  // Declared BEFORE @Get(':id') so the path doesn't shadow this.

  @Get(':id/export')
  async exportTicketHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.supportService.exportTicketHistory(
      user,
      id,
    );
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    });
    res.send(csv);
  }

  // Compliance/audit archive — ZIP bundling conversation,
  // attachments, audit trail, SLA events, and a manifest with
  // SHA-256 hashes. Access check lives in the service (same as
  // the CSV export — owner or assigned/privileged staff).

  @Get(':id/export-archive')
  async exportTicketArchive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.supportService.exportTicketArchive(
      user,
      id,
    );
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-store',
    });
    res.end(buffer);
  }

  // ─── Merge candidates (supervisor/admin only) ─────────
  //
  // Powers the merge dropdown in the supervisor UI. Returns up to 20
  // open tickets from the same customer + same category that the
  // source can be merged into.

  @Get(':id/merge-candidates')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async listMergeCandidates(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException('Only supervisors can merge tickets');
    }
    return this.supportService.getMergeCandidates(id);
  }

  // ─── Student snapshot (any user with ticket access) ────
  //
  // One-glance profile shown in the ticket-detail right rail
  // so agents don't ping-pong dashboards to triage. The service
  // enforces the same owner/agent isolation as getTicketDetail.

  @Get(':id/student-context')
  async getStudentContext(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.supportService.getStudentSnapshotForTicket(user, id);
  }

  @Get(':id/student-timeline')
  async getStudentTimeline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.supportService.getStudentTimelineForTicket(user, id);
  }

  @Get(':id/certificate-details')
  async getCertificateDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.supportService.getCertificateDetailsForTicket(user, id);
  }

  // ─── Trainer application context (Amna R3) ─────────────
  //
  // Surfaces the applicant's role_request + full event timeline +
  // missing-requirements checklist on the ticket detail. Matched by
  // student email (logged-in) or guest email. Hidden by the FE when
  // no application is found.
  @Get(':id/trainer-application')
  async getTrainerApplication(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.supportService.getTrainerApplicationForTicket(user, id);
  }

  // ─── Ticket merge (supervisor/admin only) ──────────────

  @Post(':id/merge')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async mergeTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { targetTicketId: string; note?: string },
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException('Only supervisors can merge tickets');
    }
    if (!dto?.targetTicketId) {
      throw new BadRequestException('targetTicketId is required');
    }
    return this.supportService.mergeTicket(
      user,
      id,
      dto.targetTicketId,
      dto.note,
    );
  }

  // ─── Ticket transfer ───────────────────────────────────

  @Post(':id/transfer')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async transferTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: { category: string; reason?: string; reassign?: boolean },
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException('Only supervisors can transfer tickets');
    }
    if (!dto?.category) {
      throw new BadRequestException('category is required');
    }
    return this.supportService.transferTicket(user, id, dto);
  }

  // ─── Audit log for a single ticket ─────────────────────

  @Get(':id/audit')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getTicketAudit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : 100;
    return this.supportService.getTicketAuditLog(id, limit);
  }

  // ─── Attachment download log ───────────────────────────

  @Post(':id/attachment-download')
  async recordAttachmentDownload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { attachmentUrl: string },
    @Req() req: Request,
  ) {
    if (!body?.attachmentUrl) {
      throw new BadRequestException('attachmentUrl is required');
    }
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    const userAgent = (req.headers['user-agent'] as string) || null;
    return this.supportService.recordAttachmentDownload(
      user,
      id,
      body.attachmentUrl,
      ip,
      userAgent,
    );
  }

  @Get(':id/attachment-download-log')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getAttachmentDownloadLog(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (
      user.supportSubRole !== 'supervisor' &&
      !user.roles.includes('ADMIN') &&
      !user.roles.includes('SUPER_ADMIN')
    ) {
      throw new ForbiddenException(
        'Only supervisors can view attachment download logs',
      );
    }
    return this.supportService.getAttachmentDownloadLog(id);
  }

  // ─── Attachment version history (Amna R4) ──────────────
  //
  // Full timeline of every upload + soft-delete on the ticket.
  // Staff-only; assignment + supervisor + admin gating handled in
  // the service.

  @Get(':id/attachment-history')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getAttachmentHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.supportService.getAttachmentHistory(user, id);
  }

  @Delete(':id/attachments/:attachmentId')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async softDeleteAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
  ) {
    return this.supportService.softDeleteAttachment(user, id, attachmentId);
  }

  // ─── Get Ticket Detail ──────────────────────────────────

  @Get(':id')
  async getTicketDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.supportService.getTicketDetail(user, id);
  }

  // ─── Update Ticket (support/admin only) ─────────────────

  @Patch(':id')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async updateTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.supportService.updateTicket(id, dto, user);
  }

  // ─── Add Comment ────────────────────────────────────────

  @Post(':id/comments')
  async addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.supportService.addComment(user, id, dto);
  }

  // ─── Hold-approval workflow ──────────────────────────────

  // Agent submits a hold request for the supervisor/admin to decide.
  // Reason must be one of HOLD_REASONS; description required only when
  // reason='other'. The service layer also rejects double-submits via
  // the unique partial index on the table.
  @Post(':id/hold-requests')
  @Roles('SUPPORT' as UserRole)
  async createHoldRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { reason: string; description?: string | null },
  ) {
    return this.supportService.createHoldRequest(user, id, {
      reason: body?.reason,
      description: body?.description ?? null,
    });
  }

  // Supervisor / admin approves or rejects a pending request. Approval
  // flips the ticket to ON_HOLD; rejection leaves it alone. Both
  // outcomes notify the requester and write an audit row.
  @Patch(':id/hold-requests/:requestId')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async decideHoldRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @Body() body: { decision: 'approved' | 'rejected'; note?: string | null },
  ) {
    return this.supportService.decideHoldRequest(user, id, requestId, {
      decision: body?.decision,
      note: body?.note ?? null,
    });
  }

  // ─── Manually escalate ticket (supervisor / admin only) ─

  @Post(':id/escalate')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async escalateTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: EscalateTicketDto,
  ) {
    return this.supportService.escalateTicket(user, id, dto);
  }

  // ─── Resolve Ticket (support/admin only) ────────────────

  @Post(':id/resolve')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async resolveTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.supportService.resolveTicket(id, user.id, user);
  }

  // ─── Close Ticket (support/admin only) ──────────────────

  @Post(':id/close')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async closeTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.supportService.closeTicket(id, user);
  }

  // ─── Apply Macro to Ticket ─────────────────────────────

  @Post(':id/apply-macro')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async applyMacro(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { macroId: string; locale?: string },
  ) {
    if (!body.macroId) {
      throw new BadRequestException('macroId is required');
    }
    // Locale comes from the client (it knows what the agent is
    // currently viewing the dashboard in). Defaults to English at the
    // service layer if absent or unrecognised.
    const locale = body.locale === 'ar' ? 'ar' : 'en';
    return this.supportService.applyMacro(body.macroId, id, {
      userId: user.id,
      locale,
    });
  }

}
