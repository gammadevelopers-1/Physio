import { Body, Controller, Delete, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators';
import { CancelDeletionDto, DeleteAccountDto } from './dto/delete-account.dto';
import {
  GrantConsentDto,
  SetMarketingConsentDto,
  WithdrawConsentDto,
} from './dto/consent.dto';
import { ConsentsService } from './consents.service';
import { DataExportService } from './data-export.service';
import { ErasureService } from './erasure.service';

/**
 * `/me` — endpoints scoped to the authenticated user's own account.
 * PDPL Article 12 (erasure) + Article 13 (portability) live here.
 */
@Controller('me')
export class MeController {
  constructor(
    private readonly erasureService: ErasureService,
    private readonly dataExportService: DataExportService,
    private readonly consentsService: ConsentsService,
  ) {}

  /**
   * PDPL right to erasure — soft delete + 30-day grace.
   * Requires current password to prevent unauthorized cascade.
   */
  @Delete('account')
  @UseGuards(JwtAuthGuard)
  async requestAccountDeletion(
    @CurrentUser() user: { id: string },
    @Body() dto: DeleteAccountDto,
    @Req() req: Request,
  ) {
    const ip = (req.ip || req.socket.remoteAddress) ?? undefined;
    return this.erasureService.requestErasure(
      user.id,
      dto.password,
      dto.reason,
      ip,
    );
  }

  /**
   * Cancel a pending deletion via signed token from the confirmation
   * email. Public because the user's account is inactive during the
   * grace window — they can't log in to hit an authenticated route.
   */
  @Public()
  @Post('account/cancel-deletion')
  async cancelDeletion(
    @Body() dto: CancelDeletionDto,
    @Req() req: Request,
  ) {
    const ip = (req.ip || req.socket.remoteAddress) ?? undefined;
    return this.erasureService.cancelErasure(dto.token, ip);
  }

  /**
   * PDPL Article 13 — Right to Data Portability.
   * Returns the user's data as JSON. Rate-limited to 1/24h server-side.
   */
  @Get('export')
  @UseGuards(JwtAuthGuard)
  async exportMyData(
    @CurrentUser() user: { id: string },
    @Req() req: Request,
  ) {
    const ip = (req.ip || req.socket.remoteAddress) ?? undefined;
    return this.dataExportService.exportUserData(user.id, ip);
  }

  /**
   * PDPL — Right to view the full consent ledger + current status.
   */
  @Get('consents')
  @UseGuards(JwtAuthGuard)
  async listConsents(@CurrentUser() user: { id: string }) {
    return this.consentsService.listMyConsents(user.id);
  }

  /**
   * PDPL — Grant/re-grant a consent (marketing, sensitive-data, or
   * accept a bumped Terms/Privacy version). Idempotent from the
   * client's perspective; the server always appends a new ledger row.
   */
  @Post('consents')
  @UseGuards(JwtAuthGuard)
  async grantConsent(
    @CurrentUser() user: { id: string },
    @Body() dto: GrantConsentDto,
    @Req() req: Request,
  ) {
    const ip = (req.ip || req.socket.remoteAddress) ?? undefined;
    const ua = req.get('user-agent') ?? undefined;
    return this.consentsService.grantConsent(user.id, dto.type, ip, ua);
  }

  /**
   * PDPL — Withdraw a previously granted consent. Sets `withdrawnAt`
   * on the active row; never deletes ledger entries.
   */
  @Post('consents/withdraw')
  @UseGuards(JwtAuthGuard)
  async withdrawConsent(
    @CurrentUser() user: { id: string },
    @Body() dto: WithdrawConsentDto,
    @Req() req: Request,
  ) {
    const ip = (req.ip || req.socket.remoteAddress) ?? undefined;
    return this.consentsService.withdrawConsent(user.id, dto.type, ip);
  }

  /**
   * PDPL — Convenience toggle for marketing email opt-in used by the
   * Preferences UI. Wraps grant/withdraw with one boolean.
   */
  @Patch('consents/marketing')
  @UseGuards(JwtAuthGuard)
  async setMarketingConsent(
    @CurrentUser() user: { id: string },
    @Body() dto: SetMarketingConsentDto,
    @Req() req: Request,
  ) {
    const ip = (req.ip || req.socket.remoteAddress) ?? undefined;
    const ua = req.get('user-agent') ?? undefined;
    return this.consentsService.setMarketingConsent(
      user.id,
      dto.enabled,
      ip,
      ua,
    );
  }
}
