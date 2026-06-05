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

  // ─── Ticket Tags ───────────────────────────────────────
  // The registry is read by any authenticated support user (agents need
  // it to render chips) but mutations are supervisor/admin-gated. The
  // per-ticket setter accepts the full desired tag set so the call is
  // idempotent — see service.setTicketTags for the diff logic.

  @Get('tags')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async listTicketTags() {
    return this.supportService.listTicketTags();
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
