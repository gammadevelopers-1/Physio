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
  CreateEscalationPathDto,
  UpdateEscalationPathDto,
} from './dto';

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

  // ─── Get KPIs (support/admin only) ──────────────────────

  @Get('kpis')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getKPIs() {
    return this.supportService.getKPIs();
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

  // ─── Admin Support KPIs ────────────────────────────────

  @Get('admin/support-kpis')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getAdminSupportKpis() {
    return this.supportService.getAdminSupportKpis();
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
  // render admin-added categories. Mutations (POST/DELETE below) stay
  // role-gated. The list only exposes slug + names + auto-priority —
  // nothing sensitive.
  @Public()
  @Get('settings/ticket-categories')
  async listTicketCategories() {
    return this.supportService.listTicketCategories();
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
  async getCsatSummary() {
    return this.supportService.getCsatSummary();
  }

  @Get('nps/summary')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getNpsSummary() {
    return this.supportService.getNpsSummary();
  }

  // ─── Macros CRUD (Support/Admin only) ───────────────────

  @Get('macros')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getMacros() {
    return this.supportService.getMacros();
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

  // ─── CSAT Survey (Public — no auth required) ──────────

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

  // ─── Escalation Paths CRUD ──────────────────────────────
  // Same route-ordering rule: MUST be before @Get(':id')

  @Get('escalation-paths')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getEscalationPaths() {
    return this.supportService.getEscalationPaths();
  }

  @Post('escalation-paths')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async createEscalationPath(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEscalationPathDto,
  ) {
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN');
    if (!isSupervisorOrAdmin) {
      throw new ForbiddenException(
        'Only supervisors can manage escalation paths',
      );
    }
    return this.supportService.createEscalationPath(dto);
  }

  @Patch('escalation-paths/:id')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async updateEscalationPath(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEscalationPathDto,
  ) {
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN');
    if (!isSupervisorOrAdmin) {
      throw new ForbiddenException(
        'Only supervisors can manage escalation paths',
      );
    }
    return this.supportService.updateEscalationPath(id, dto);
  }

  @Delete('escalation-paths/:id')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async deleteEscalationPath(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN');
    if (!isSupervisorOrAdmin) {
      throw new ForbiddenException(
        'Only supervisors can manage escalation paths',
      );
    }
    return this.supportService.deleteEscalationPath(id);
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
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { macroId: string },
  ) {
    if (!body.macroId) {
      throw new BadRequestException('macroId is required');
    }
    return this.supportService.applyMacro(body.macroId, id);
  }

}
