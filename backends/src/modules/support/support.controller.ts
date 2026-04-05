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
} from '@nestjs/common';
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

  // ─── NPS Survey (Public — no auth required) ────────────

  @Public()
  @Get('nps/:surveyId')
  async getNpsSurvey(
    @Param('surveyId', new ParseUUIDPipe()) surveyId: string,
  ) {
    return this.supportService.getNpsSurvey(surveyId);
  }

  @Public()
  @Post('nps/:surveyId')
  async submitNpsScore(
    @Param('surveyId', new ParseUUIDPipe()) surveyId: string,
    @Body() body: { score: number; comment?: string },
  ) {
    if (body.score === undefined || body.score < 0 || body.score > 10) {
      throw new ForbiddenException('Score must be between 0 and 10');
    }
    return this.supportService.submitNpsScore(
      surveyId,
      body.score,
      body.comment,
    );
  }

  // ─── Guest Ticket (Login Issues Only — no auth) ────────

  @Public()
  @Post('guest')
  async createGuestTicket(@Body() dto: CreateGuestTicketDto) {
    return this.supportService.createGuestTicket(dto);
  }

  @Public()
  @Get('track/:trackingToken')
  async getTicketByTrackingToken(
    @Param('trackingToken') token: string,
  ) {
    return this.supportService.getTicketByTrackingToken(token);
  }

  @Public()
  @Post('track/:trackingToken/reply')
  async addGuestReply(
    @Param('trackingToken') token: string,
    @Body() body: { message: string },
  ) {
    if (!body.message?.trim()) {
      throw new ForbiddenException('Message is required');
    }
    return this.supportService.addGuestReply(token, body.message.trim());
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

  // ─── Admin Support KPIs ────────────────────────────────

  @Get('admin/support-kpis')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getAdminSupportKpis() {
    return this.supportService.getAdminSupportKpis();
  }

  // ─── Reports API ───────────────────────────────────────

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
    return this.supportService.createMacro(user.id, dto);
  }

  @Patch('macros/:id')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async updateMacro(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMacroDto,
  ) {
    return this.supportService.updateMacro(id, dto);
  }

  @Delete('macros/:id')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async deleteMacro(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.supportService.deleteMacro(id);
  }

  // ─── Knowledge Base (Public read, Admin write) ────────

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
  @Get('csat/:surveyId')
  async getCsatSurvey(
    @Param('surveyId', new ParseUUIDPipe()) surveyId: string,
  ) {
    return this.supportService.getCsatSurvey(surveyId);
  }

  @Public()
  @Post('csat/:surveyId')
  async submitCsatScore(
    @Param('surveyId', new ParseUUIDPipe()) surveyId: string,
    @Body() body: { score: number; comment?: string },
  ) {
    if (!body.score || body.score < 1 || body.score > 5) {
      throw new ForbiddenException('Score must be between 1 and 5');
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
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.supportService.updateTicket(id, dto);
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
    return this.supportService.resolveTicket(id, user.id);
  }

  // ─── Close Ticket (support/admin only) ──────────────────

  @Post(':id/close')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async closeTicket(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.supportService.closeTicket(id);
  }

  // ─── Apply Macro to Ticket ─────────────────────────────

  @Post(':id/apply-macro')
  @Roles('SUPPORT' as UserRole, 'ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async applyMacro(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { macroId: string },
  ) {
    if (!body.macroId) {
      throw new ForbiddenException('macroId is required');
    }
    return this.supportService.applyMacro(body.macroId, id);
  }

}
