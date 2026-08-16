import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators';
import { CancelDeletionDto, DeleteAccountDto } from './dto/delete-account.dto';
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
}
