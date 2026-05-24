import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AdminNotificationsService,
  type AdminNotificationType,
} from './admin-notifications.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
export class AdminNotificationsController {
  constructor(
    private readonly service: AdminNotificationsService,
  ) {}

  @Get()
  async list(
    @Query('type') type?: AdminNotificationType,
    @Query('unread') unread?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // unread comes in as the string "true" / "false" — interpret literally;
    // anything else (missing, "all") means both read and unread.
    let unreadFilter: boolean | undefined;
    if (unread === 'true') unreadFilter = true;
    else if (unread === 'false') unreadFilter = false;

    return this.service.list({
      type,
      unread: unreadFilter,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('counts')
  async counts() {
    return this.service.getCounts();
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    return this.service.markRead(id);
  }

  @Post('mark-all-read')
  async markAllRead() {
    return this.service.markAllRead();
  }
}
