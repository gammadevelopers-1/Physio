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
import { ROLE_NAMES } from '../../database/schema';

// `scope=team` is only honored when the caller is a SUPPORT supervisor
// or an admin. Anyone else (incl. agents) silently falls back to "own"
// scope — never throws so the bell never disappears for them.
function canUseTeamScope(user: any): boolean {
  if (!user) return false;
  const roles: string[] = user.roles || [];
  if (
    roles.includes(ROLE_NAMES.ADMIN) ||
    roles.includes(ROLE_NAMES.SUPER_ADMIN)
  )
    return true;
  return (
    roles.includes(ROLE_NAMES.SUPPORT) && user.supportSubRole === 'supervisor'
  );
}

@Controller('user-notifications')
export class UserNotificationsController {
  constructor(
    private readonly notificationsService: UserNotificationsService,
  ) {}

  /**
   * GET /user-notifications?limit=50&unreadOnly=false&scope=team
   * Returns notifications list + unread count.
   * `scope=team` widens to all SUPPORT users (supervisor / admin only).
   */
  @Get()
  async findAll(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('scope') scope?: string,
  ) {
    const teamScope = scope === 'team' && canUseTeamScope(req.user);
    return this.notificationsService.findAllForUser(req.user.id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      unreadOnly: unreadOnly === 'true',
      teamScope,
    });
  }

  /**
   * GET /user-notifications/unread-count?scope=team
   * Lightweight endpoint for polling
   */
  @Get('unread-count')
  async getUnreadCount(@Req() req: any, @Query('scope') scope?: string) {
    const teamScope = scope === 'team' && canUseTeamScope(req.user);
    const count = await this.notificationsService.getUnreadCount(req.user.id, {
      teamScope,
    });
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
