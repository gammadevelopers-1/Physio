import { Controller, Get, Param, ParseEnumPipe } from '@nestjs/common';
import { AdminSettingsService } from './admin-settings.service';
import { TemplatesService } from '../templates/templates.service';
import { Public } from '../auth/decorators';

enum LocaleParam {
  EN = 'en',
  AR = 'ar',
}

/**
 * Unauthenticated read of the locale settings — needed by marketing
 * pages, the next-intl middleware, and the public-facing client
 * bootstrap. Returns only the four whitelisted fields; never reveals
 * anything else from the localization row.
 */
@Public()
@Controller('public')
export class PublicSettingsController {
  constructor(
    private readonly settingsService: AdminSettingsService,
    private readonly templatesService: TemplatesService,
  ) {}

  @Get('locale-settings')
  async getLocaleSettings() {
    return this.settingsService.getPublicLocaleSettings();
  }

  @Get('general-settings')
  async getGeneralSettings() {
    return this.settingsService.getPublicGeneralSettings();
  }

  @Get('password-policy')
  async getPasswordPolicy() {
    return this.settingsService.getPublicPasswordPolicy();
  }

  @Get('maintenance-status')
  async getMaintenanceStatus() {
    return this.settingsService.getMaintenanceStatus();
  }

  @Get('notification-channels')
  async getNotificationChannels() {
    return this.settingsService.getPublicNotificationChannels();
  }

  /**
   * Public read of a WhatsApp template body. Used by the marketing /
   * dashboard WhatsApp share helpers so admin edits take effect on
   * the client without authentication. Only returns the raw body —
   * never subject, designJson, or any email content.
   */
  @Get('whatsapp-template/:eventKey/:locale')
  async getWhatsAppTemplate(
    @Param('eventKey') eventKey: string,
    @Param('locale', new ParseEnumPipe(LocaleParam)) locale: LocaleParam,
  ): Promise<{ body: string | null; enabled: boolean }> {
    try {
      const detail = await this.templatesService.get(eventKey, locale);
      if (detail.meta.channel !== 'whatsapp') {
        return { body: null, enabled: false };
      }
      return {
        body: detail.hasOverride && detail.body ? detail.body : null,
        enabled: detail.enabled,
      };
    } catch {
      return { body: null, enabled: false };
    }
  }
}
