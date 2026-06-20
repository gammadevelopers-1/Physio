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
import { ReconciliationService } from './reconciliation.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';

/**
 * Finance-only reconciliation API. Drift between our payments table and the
 * gateways' own records is surfaced here so finance can resolve / ignore
 * each finding manually. Scans can be triggered ad-hoc from the UI; a daily
 * cron will be wired up in Phase 3.
 */
@Controller('payments/reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FINANCE', 'ADMIN', 'SUPER_ADMIN')
export class ReconciliationController {
  constructor(private readonly service: ReconciliationService) {}

  @Get('stats')
  async getStats() {
    return this.service.getStats();
  }

  @Get('findings')
  async listFindings(
    @Query('status') status?: 'unresolved' | 'resolved' | 'ignored' | 'all',
    @Query('gateway') gateway?: string,
    @Query('driftType') driftType?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.service.listFindings({ status, gateway, driftType, page, limit });
  }

  /**
   * Trigger a scan on demand. Defaults to the last 7 days for `moyasar`.
   * Rate-limited to 5/min to prevent accidental hammer-clicking from running
   * many concurrent Moyasar paginated fetches.
   */
  @Post('scan')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async runScan(
    @Body() body: { gateway?: 'moyasar' | 'all'; fromDate?: string; toDate?: string } = {},
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const to = body.toDate ? new Date(body.toDate) : new Date();
    const from = body.fromDate
      ? new Date(body.fromDate)
      : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    return this.service.runScan({
      gateway: body.gateway || 'moyasar',
      fromDate: from,
      toDate: to,
      triggeredBy: user.id,
    });
  }

  @Patch('findings/:id/resolve')
  async resolve(
    @Param('id') findingId: string,
    @Body() body: { note?: string } = {},
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ip =
      req.ip ||
      (req.connection as { remoteAddress?: string } | undefined)?.remoteAddress ||
      'unknown';
    return this.service.resolveFinding(findingId, user, body.note, ip);
  }

  @Patch('findings/:id/ignore')
  async ignore(
    @Param('id') findingId: string,
    @Body() body: { note?: string } = {},
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ip =
      req.ip ||
      (req.connection as { remoteAddress?: string } | undefined)?.remoteAddress ||
      'unknown';
    return this.service.ignoreFinding(findingId, user, body.note, ip);
  }
}
