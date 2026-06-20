import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { EscalationsService } from './escalations.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';

/**
 * Reconciliation escalation API.
 *
 *   Finance + Admin   → escalate a finding (POST /findings/:id/escalate)
 *   Finance + Admin   → list / view escalations (read-only for finance)
 *   Admin + SuperAdmin → claim / sendBack / close (act on escalations)
 *
 * Phase E.2 / E.3 will add enroll / refund action endpoints under
 * /escalations/:id/{enroll,refund}.
 */
@Controller('payments/reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EscalationsController {
  constructor(private readonly service: EscalationsService) {}

  // ─── Finance + Admin: create an escalation from an existing finding ───

  @Post('findings/:findingId/escalate')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  // 10/min — escalating is a deliberate action, runaway clicks would
  // indicate a UI bug not a legitimate use-case.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async escalateFinding(
    @Param('findingId') findingId: string,
    @Body() body: { note?: string; proposedAction?: string; urgency?: string } = {},
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ip = this.extractIp(req);
    return this.service.escalateFinding(
      findingId,
      user,
      {
        note: body.note || '',
        proposedAction: body.proposedAction || '',
        urgency: body.urgency,
      },
      ip,
    );
  }

  // ─── Read endpoints (Finance read-only; Admin everything) ─────────────

  @Get('escalations')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async listEscalations(
    @Query('status') status?:
      | 'pending'
      | 'in_progress'
      | 'resolved'
      | 'declined'
      | 'sent_back'
      | 'all',
    @Query('gateway') gateway?: string,
    @Query('urgency') urgency?: 'low' | 'normal' | 'high',
    @Query('escalatedBy') escalatedBy?: string,
    @Query('claimedBy') claimedBy?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.service.listEscalations({
      status,
      gateway,
      urgency,
      escalatedBy,
      claimedBy,
      page,
      limit,
    });
  }

  @Get('escalations/stats')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getStats() {
    return this.service.getStats();
  }

  @Get('escalations/:id')
  @Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
  async getEscalation(@Param('id') id: string) {
    return this.service.getEscalation(id);
  }

  // ─── Admin-only transitions ──────────────────────────────────────────

  @Patch('escalations/:id/claim')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async claim(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.service.claim(id, user, this.extractIp(req));
  }

  @Patch('escalations/:id/send-back')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async sendBack(
    @Param('id') id: string,
    @Body() body: { note?: string } = {},
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.service.sendBack(id, user, body.note, this.extractIp(req));
  }

  @Patch('escalations/:id/close')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async close(
    @Param('id') id: string,
    @Body() body: { note?: string } = {},
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.service.close(id, user, body.note, this.extractIp(req));
  }

  // ─── E.2 + E.3 admin actions ─────────────────────────────────────────

  /**
   * Manual enrollment from an escalation. Transactionally creates a payment
   * row (for missing_local), creates the enrollment, marks escalation +
   * finding resolved, and emails the student via existing enrollment-
   * confirmation flow. See EscalationsService.enrollFromEscalation for the
   * full failure/rollback behavior.
   */
  @Post('escalations/:id/enroll')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async enroll(
    @Param('id') id: string,
    @Body()
    body: {
      studentId?: string;
      courseId?: string;
      note?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.service.enrollFromEscalation(
      id,
      user,
      {
        studentId: body.studentId || '',
        courseId: body.courseId || '',
        note: body.note || '',
      },
      this.extractIp(req),
    );
  }

  /**
   * Admin-initiated refund from an escalation. Creates the refund row in
   * APPROVED state (skips the student-request → finance-approve flow used
   * elsewhere), calls the gateway, marks escalation + finding resolved on
   * success. On gateway failure, the refund row stays APPROVED for retry
   * from the Refunds page and the escalation stays open.
   */
  @Post('escalations/:id/refund')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refund(
    @Param('id') id: string,
    @Body()
    body: {
      amount?: number;
      reason?: string;
      note?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.service.refundFromEscalation(
      id,
      user,
      {
        amount: body.amount,
        reason: body.reason || '',
        note: body.note || '',
      },
      this.extractIp(req),
    );
  }

  private extractIp(req: Request): string {
    return (
      req.ip ||
      (req.connection as { remoteAddress?: string } | undefined)?.remoteAddress ||
      'unknown'
    );
  }
}
