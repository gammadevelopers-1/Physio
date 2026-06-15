import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import type { UserRole } from '../../database/schema';
import { ServiceStatusService } from './service-status.service';
import { randomBytes } from 'crypto';
import {
  CreateIncidentDto,
  LinkTicketDto,
  PostIncidentUpdateDto,
  UpdateComponentStatusDto,
  UpdateIncidentReportDto,
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

  /**
   * Fire-and-forget view tracker. Cookie-deduped server-side — the
   * client just hits this once per page load. Returns an empty body
   * + a session cookie so subsequent calls from the same browser
   * collapse into one event.
   */
  @Post('view')
  @Header('Cache-Control', 'no-store')
  async recordView(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body?: { incidentId?: string },
  ) {
    const COOKIE = 'pg_status_session';
    let session = req.cookies?.[COOKIE];
    if (!session) {
      session = randomBytes(16).toString('hex');
      res.cookie(COOKIE, session, {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        maxAge: 60 * 60 * 1000, // 1 hour
        path: '/',
      });
    }
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '';
    await this.service.recordStatusView({
      incidentId: body?.incidentId,
      ip,
      sessionCookie: session,
    });
    return { ok: true };
  }

  /**
   * Public-safe stats for the /status page transparency footer.
   * "Last 30 days: X incidents · Y min avg resolution."
   */
  @Get('summary')
  async getSummary() {
    return this.service.getPublicAnalyticsSummary();
  }

  /**
   * Paginated archive of resolved incidents — no auth, same access
   * model as the main status page. Powers `/[locale]/status/history`.
   */
  @Get('history')
  async getStatusHistory(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('severity') severity?: string,
    @Query('component') component?: string,
  ) {
    const sevOK =
      severity === 'minor' || severity === 'major' || severity === 'critical'
        ? severity
        : undefined;
    return this.service.getStatusHistory({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      severity: sevOK,
      component: component || undefined,
    });
  }
}

// ─── Authenticated reads + ticket-link writes ─────────────────
//
// Two surfaces collapsed into one controller because they share the
// "any logged-in user can hit, role-aware semantics inside" pattern:
//
//   GET  /service-status/banner-incidents  → cross-dashboard banner
//   GET  /service-status/active-for-link   → support agent picker
//   POST /service-status/incidents/:id/link-ticket   → support+admin
//   DELETE /service-status/incidents/:id/link-ticket/:ticketId
//   GET  /service-status/tickets/:ticketId/incidents → linked incidents
//
// Banner needs role context to filter — pulled off CurrentUser.
// Link/unlink check that the actor is support/admin.

@Controller('service-status')
@UseGuards(JwtAuthGuard)
export class AuthedServiceStatusController {
  constructor(private readonly service: ServiceStatusService) {}

  private assertSupportOrAdmin(user: AuthenticatedUser) {
    const allowed = ['SUPPORT', 'ADMIN', 'SUPER_ADMIN'];
    if (!user.roles.some((r) => allowed.includes(r))) {
      throw new ForbiddenException(
        'Only support staff or admins can link tickets to incidents',
      );
    }
  }

  /**
   * Cross-dashboard banner feed — returns active end-user incidents
   * targeted at the caller's role(s). Empty list when nothing is
   * active. Used by `<IncidentBanner />` on Student/Instructor/CM/TA/
   * Finance dashboards.
   */
  @Get('banner-incidents')
  async listBannerIncidents(@CurrentUser() user: AuthenticatedUser) {
    // A user can have multiple roles; surface incidents targeted at
    // any of them. Dedupe by incident id.
    const perRole = await Promise.all(
      user.roles.map((r) =>
        this.service.listActiveBannerIncidentsForRole(r),
      ),
    );
    const seen = new Set<string>();
    const merged: Array<
      Awaited<ReturnType<typeof this.service.listActiveBannerIncidentsForRole>>[number]
    > = [];
    for (const list of perRole) {
      for (const inc of list) {
        if (seen.has(inc.id)) continue;
        seen.add(inc.id);
        merged.push(inc);
      }
    }
    return merged;
  }

  /**
   * Lightweight picker feed for the support-side "Link to incident"
   * widget. Active (unresolved) incidents only. Anyone logged in can
   * call it but only support/admin can act on the result via link.
   */
  @Get('active-for-link')
  async listActiveForLink(@CurrentUser() user: AuthenticatedUser) {
    this.assertSupportOrAdmin(user);
    return this.service.listActiveIncidentsForLinking();
  }

  @Post('incidents/:id/link-ticket')
  async linkTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) incidentId: string,
    @Body() dto: LinkTicketDto,
  ) {
    this.assertSupportOrAdmin(user);
    return this.service.linkTicket(incidentId, dto.ticketId, user.id);
  }

  @Delete('incidents/:id/link-ticket/:ticketId')
  async unlinkTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) incidentId: string,
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
  ) {
    this.assertSupportOrAdmin(user);
    return this.service.unlinkTicket(incidentId, ticketId);
  }

  @Get('tickets/:ticketId/incidents')
  async listIncidentsForTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
  ) {
    this.assertSupportOrAdmin(user);
    return this.service.listIncidentsForTicket(ticketId);
  }

  /**
   * Support-scoped read of the tickets linked to an incident — used
   * by the SupportActiveIncidentsBar expand panel. Same payload as
   * the admin endpoint but with the support+admin role gate.
   */
  @Get('incidents/:id/tickets')
  async listTicketsForIncident(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    this.assertSupportOrAdmin(user);
    return this.service.listTicketsForIncident(id);
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

  // ─── Post-mortem report + linked tickets ────────────────────

  @Get('incidents/:id/report')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getIncidentReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    this.assertAdmin(user);
    return this.service.getIncidentReport(id);
  }

  @Patch('incidents/:id/report')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async updateIncidentReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateIncidentReportDto,
  ) {
    this.assertAdmin(user);
    return this.service.updateIncidentReport(id, dto);
  }

  @Get('incidents/:id/tickets')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async listTicketsForIncident(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    this.assertAdmin(user);
    return this.service.listTicketsForIncident(id);
  }

  // ─── Analytics + export ─────────────────────────────────────

  @Get('analytics')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  async getAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.assertAdmin(user);
    return this.service.getAnalytics({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('incidents/export.csv')
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportIncidentsCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    this.assertAdmin(user);
    const csv = await this.service.exportIncidentsCsv({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    const filename = `incidents-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    return csv;
  }
}
