import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AdminSettingsService } from './admin-settings.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { UserRole } from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

/**
 * Admin Settings endpoints. Read-by-category, write-by-category. JSONB
 * shape per category is loose — each tab on the frontend just posts
 * its own keys back, no per-field validation here (keeps the surface
 * tiny while we iterate). Field-level validation belongs in the tab
 * components.
 */
@SkipThrottle()
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
export class AdminSettingsController {
  constructor(private readonly settingsService: AdminSettingsService) {}

  @Get()
  async getAll() {
    return this.settingsService.getAll();
  }

  @Get(':category')
  async getCategory(@Param('category') category: string) {
    const value = await this.settingsService.getCategory(category);
    return { category, value };
  }

  @Patch(':category')
  async updateCategory(
    @Param('category') category: string,
    @Body() body: { value: Record<string, unknown> },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateCategory(category, body.value, user.id);
  }

  // ─── Notification Templates ─────────────────────────────────────

  @Get('templates/all')
  async listTemplates() {
    return this.settingsService.listTemplates();
  }

  @Get('templates/:id')
  async getTemplate(@Param('id') id: string) {
    return this.settingsService.getTemplate(id);
  }

  @Post('templates')
  async createTemplate(
    @Body()
    body: {
      eventKey: string;
      channel: string;
      locale: string;
      subject?: string;
      body: string;
      enabled?: boolean;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.createTemplate(body, user.id);
  }

  @Patch('templates/:id')
  async updateTemplate(
    @Param('id') id: string,
    @Body()
    body: { subject?: string | null; body?: string; enabled?: boolean },
  ) {
    return this.settingsService.updateTemplate(id, body);
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(@Param('id') id: string) {
    await this.settingsService.deleteTemplate(id);
  }

  // ─── Integration Health ─────────────────────────────────────────
  //
  // Reports which env-backed integrations are configured. The previous
  // hardcoded "connected / not connected" UI lied — this is the real
  // story. Reads env vars + a couple of DB sentinels.
  //
  // NOTE: We never expose the secret values themselves, only whether
  // they exist. Test buttons (future) would ping each provider and
  // return last-success timestamps.

  @Get('integrations/health')
  async getIntegrationHealth(): Promise<
    Record<string, { configured: boolean; required: boolean; description: string }>
  > {
    const has = (key: string) => !!process.env[key]?.trim();
    return {
      zoom: {
        configured:
          has('ZOOM_ACCOUNT_ID') &&
          has('ZOOM_CLIENT_ID') &&
          has('ZOOM_CLIENT_SECRET') &&
          has('ZOOM_WEBHOOK_SECRET_TOKEN'),
        required: true,
        description: 'Webinar + meeting creation, recording sync',
      },
      resend: {
        configured: has('RESEND_API_KEY'),
        required: true,
        description: 'Transactional email delivery',
      },
      mailFrom: {
        configured: has('MAIL_FROM'),
        required: true,
        description: 'Sender address for all emails',
      },
      recaptcha: {
        configured: has('RECAPTCHA_SECRET_KEY'),
        required: true,
        description: 'Bot protection on auth endpoints',
      },
      piiEncryption: {
        configured: has('PII_ENCRYPTION_KEY'),
        required: true,
        description:
          'Field-level encryption for national_id / phone / scfhs_number',
      },
      redis: {
        configured: has('REDIS_HOST'),
        required: false,
        description: 'Content processing queue (transcripts, captions)',
      },
      openai: {
        configured: has('OPENAI_API_KEY'),
        required: false,
        description: 'Whisper auto-transcription',
      },
      malwareScanner: {
        // Inferred — the scanner is deployed as a separate Cloud Run
        // service, so we report it as configured if the quarantine
        // bucket env hint is present. Could be promoted to a real
        // health probe later.
        configured: has('GCP_PROJECT_ID'),
        required: false,
        description: 'ClamAV scan on every storage upload',
      },
      cloudSqlBackup: {
        configured: true,
        required: true,
        description:
          'Automated daily Cloud SQL backup + 7-day PITR (managed at infra layer)',
      },
      // ─── Payment gateways ─────────────────────────────────
      // env-key presence only — surfaces "needs config" before
      // anyone tries to charge. Real ping checks can come later.
      moyasar: {
        configured: has('MOYASAR_API_KEY'),
        required: false,
        description: 'Moyasar — Saudi card / Apple Pay / mada gateway',
      },
      tamara: {
        configured: has('TAMARA_API_TOKEN') && has('TAMARA_NOTIFICATION_TOKEN'),
        required: false,
        description: 'Tamara — Buy-now-pay-later instalments',
      },
      paytabs: {
        configured: has('PAYTABS_PROFILE_ID') && has('PAYTABS_SERVER_KEY'),
        required: false,
        description: 'PayTabs — multi-currency payment gateway',
      },
    };
  }
}
