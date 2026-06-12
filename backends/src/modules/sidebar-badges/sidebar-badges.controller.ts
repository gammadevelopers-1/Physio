import { Controller, Get, Post, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { SidebarBadgesService } from './sidebar-badges.service';

@Controller('me/sidebar-badges')
export class SidebarBadgesController {
  constructor(private readonly service: SidebarBadgesService) {}

  /**
   * Returns a map of tabKey → unread count. The FE polls this every
   * 60s while a dashboard is mounted. Capped at default throttle —
   * a single dashboard refresh costs one call and the count queries
   * are cheap (indexed lookups against narrow filters).
   */
  @Get()
  async getBadges(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getBadges(user);
  }

  /**
   * Bumps the user's viewed_at for a tab to NOW(). The FE calls this
   * from each badge-eligible page on mount. Higher throttle — tab
   * switching can fire several of these in a row.
   */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post(':tabKey/viewed')
  async markViewed(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tabKey') tabKey: string,
  ) {
    await this.service.markViewed(user, tabKey);
    return { success: true };
  }
}
