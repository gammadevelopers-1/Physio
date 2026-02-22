import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PreferencesService } from './preferences.service';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';
import { UpdateUiPrefsDto } from './dto/update-ui-prefs.dto';
import { UpdatePolicyPrefsDto } from './dto/update-policy-prefs.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UserRole } from '../../database/schema';

@Controller('preferences')
@UseGuards(JwtAuthGuard)
export class PreferencesController {
  constructor(private preferencesService: PreferencesService) {}

  /**
   * GET /preferences — Get all preferences (creates defaults if none exist)
   */
  @Get()
  async getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.preferencesService.getPreferences(user.id);
  }

  /**
   * PATCH /preferences/notifications — Update notification preferences
   */
  @Patch('notifications')
  async updateNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPrefsDto,
  ) {
    return this.preferencesService.updateNotifications(user.id, dto);
  }

  /**
   * PATCH /preferences/ui — Update UI preferences
   */
  @Patch('ui')
  async updateUiPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUiPrefsDto,
  ) {
    return this.preferencesService.updateUiPreferences(user.id, dto);
  }

  /**
   * PATCH /preferences/policies — Update default policy preferences (MANAGER/ADMIN only)
   */
  @Patch('policies')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER' as UserRole, 'ADMIN' as UserRole)
  async updatePolicies(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePolicyPrefsDto,
  ) {
    return this.preferencesService.updatePolicies(user.id, dto);
  }
}
