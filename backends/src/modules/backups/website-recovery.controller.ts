import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { WebsiteRecoveryService } from './website-recovery.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

interface RollbackBody {
  revisionName?: string;
  confirmDomain?: string;
}

/**
 * Admin website-recovery endpoints. Lists Cloud Run revisions of the
 * frontend service and lets the admin roll traffic to a prior revision.
 * Gated by the same JwtAuthGuard + RolesGuard pattern used everywhere
 * else in the admin surface; the service layer requires a server-side
 * type-domain confirmation on top.
 */
@SkipThrottle()
@Controller('admin/backups/website')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
export class WebsiteRecoveryController {
  constructor(private readonly recovery: WebsiteRecoveryService) {}

  @Get('config')
  getConfig() {
    return this.recovery.getConfig();
  }

  @Get('revisions')
  listRevisions() {
    return this.recovery.listRevisions();
  }

  @Post('rollback')
  rollback(
    @Body() body: RollbackBody,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.recovery.rollback(
      body?.revisionName || '',
      body?.confirmDomain || '',
      user.id,
      req.ip,
    );
  }
}
