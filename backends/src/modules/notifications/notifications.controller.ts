import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';

@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  // GET /notifications - List admin notifications
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Get()
  async findAll(
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.findAll({
      limit: limit ? parseInt(limit, 10) : undefined,
      unreadOnly: unreadOnly === 'true',
    });
  }

  // PATCH /notifications/read-all - Mark all as read
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Patch('read-all')
  async markAllAsRead() {
    return this.notificationsService.markAllAsRead();
  }

  // PATCH /notifications/:id/read - Mark one as read
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }
}
