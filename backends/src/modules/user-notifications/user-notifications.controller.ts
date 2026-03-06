import {
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { UserNotificationsService } from './user-notifications.service';

@Controller('user-notifications')
export class UserNotificationsController {
  constructor(
    private readonly notificationsService: UserNotificationsService,
  ) {}

  /**
   * GET /user-notifications?limit=50&unreadOnly=false
   * Returns notifications list + unread count
   */
  @Get()
  async findAll(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.findAllForUser(req.user.id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      unreadOnly: unreadOnly === 'true',
    });
  }

  /**
   * GET /user-notifications/unread-count
   * Lightweight endpoint for polling
   */
  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return { unreadCount: count };
  }

  /**
   * PATCH /user-notifications/:id/read
   * Mark a single notification as read
   */
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  /**
   * PATCH /user-notifications/read-all
   * Mark all notifications as read for the authenticated user
   */
  @Patch('read-all')
  async markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  /**
   * DELETE /user-notifications/clear-all
   * Delete all notifications for the authenticated user
   */
  @Delete('clear-all')
  async clearAll(@Req() req: any) {
    return this.notificationsService.clearAll(req.user.id);
  }
}
