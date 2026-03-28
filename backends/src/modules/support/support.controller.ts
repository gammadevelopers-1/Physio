import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
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

  // ─── SLA Policy Endpoints ──────────────────────────────

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
}
