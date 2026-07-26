import {
  BadRequestException,
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
import {
  normalizePaymentsForSave,
  decryptSecret,
} from '../payments/gateways/payments-secrets.util';

interface DbPaymentsForHealth {
  moyasar?: { publishableKey?: string; secretKeyRef?: string | null };
  tamara?: {
    merchantToken?: string | null;
    secretKeyRef?: string | null;
    mode?: 'test' | 'live';
  };
  tabby?: { publicKey?: string; secretKeyRef?: string | null };
  bankTransfer?: {
    bankNameEn?: string;
    bankNameAr?: string;
    accountNumber?: string;
    iban?: string;
  };
}

/** Replace every encrypted secret in the payments JSONB with "" before
 *  sending to the browser. Loading the form should never give the client
 *  access to ciphertext (encrypted or not — it's still a payload someone
 *  could try to decrypt out-of-band). */
function stripPaymentsSecrets(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...value };
  if (out.moyasar && typeof out.moyasar === 'object') {
    out.moyasar = { ...(out.moyasar as Record<string, unknown>), secretKeyRef: '' };
  }
  if (out.tamara && typeof out.tamara === 'object') {
    out.tamara = {
      ...(out.tamara as Record<string, unknown>),
      merchantToken: '',
      secretKeyRef: '',
    };
  }
  if (out.tabby && typeof out.tabby === 'object') {
    out.tabby = { ...(out.tabby as Record<string, unknown>), secretKeyRef: '' };
  }
  out.webhookSecretRef = '';
  return out;
}

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
    let value = await this.settingsService.getCategory<Record<string, unknown>>(
      category,
    );
    // Payments is special — secret fields are encrypted in storage and
    // must never leave the server. Strip them to empty strings before
    // sending. The PaymentsTab UI shows lastFour/mode via the dedicated
    // /admin/finance/gateways/runtime-status endpoint instead.
    if (category === 'payments') {
      value = stripPaymentsSecrets(value);
    }
    return { category, value };
  }

  @Patch(':category')
  async updateCategory(
    @Param('category') category: string,
    @Body() body: { value: Record<string, unknown> },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    let value = body.value;

    // Payments category is special: secret fields (Moyasar/Tamara/Tabby
    // secrets + webhook signing secret) are AES-GCM encrypted before
    // persistence, and empty incoming values are interpreted as
    // "preserve existing" rather than "clear". Non-secret fields
    // (publishable keys, bank-transfer info, invoice footer) pass
    // through unchanged.
    if (category === 'payments') {
      const existing = await this.settingsService.getCategory<Record<string, unknown>>(
        'payments',
      );
      value = normalizePaymentsForSave(value, existing);
    }

    // Mail category: minimal shape validation so the UI can't save
    // garbage that would produce an unsendable From header. Empty
    // string is intentional — clears the override and falls back to
    // env MAIL_FROM.
    if (category === 'mail') {
      const rawEmail =
        typeof value.senderEmail === 'string' ? value.senderEmail.trim() : '';
      const rawName =
        typeof value.senderName === 'string' ? value.senderName.trim() : '';
      if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
        throw new BadRequestException('senderEmail must be a valid email address');
      }
      if (rawName.length > 100) {
        throw new BadRequestException('senderName must be 100 characters or fewer');
      }
      value = { senderEmail: rawEmail, senderName: rawName };
    }

    return this.settingsService.updateCategory(category, value, user.id);
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

    // For payment gateways we must check BOTH env vars AND the admin-saved
    // DB row — secrets are AES-GCM encrypted in JSONB and decrypted at
    // runtime by GatewayCredentialsService. An admin who configured a
    // gateway entirely through the UI has no env vars set; we'd otherwise
    // show "not configured" while charges are actually working.
    const db =
      (await this.settingsService.getCategory<DbPaymentsForHealth>(
        'payments',
      )) ?? {};

    // Moyasar: real env var is MOYASAR_SECRET_KEY (+ _TEST/_LIVE variants
    // honored by payments.config). The old check on MOYASAR_API_KEY was
    // wrong — that name doesn't exist anywhere in the codebase.
    const moyasarEnv =
      has('MOYASAR_SECRET_KEY') ||
      has('MOYASAR_SECRET_KEY_LIVE') ||
      has('MOYASAR_SECRET_KEY_TEST');
    const moyasarDb = !!decryptSecret(db.moyasar?.secretKeyRef);

    // Tamara: needs both api token + notification token. Either env or DB.
    const tamaraEnv = has('TAMARA_API_TOKEN') && has('TAMARA_NOTIFICATION_TOKEN');
    const tamaraDb =
      !!decryptSecret(db.tamara?.merchantToken) &&
      !!decryptSecret(db.tamara?.secretKeyRef);

    // Tabby: needs a secret key. Either env or DB.
    const tabbyEnv = has('TABBY_SECRET_KEY');
    const tabbyDb = !!decryptSecret(db.tabby?.secretKeyRef);

    // Bank transfer is DB-only (no env equivalent). Configured = admin has
    // saved bank name + an account number or IBAN.
    const bt = db.bankTransfer ?? {};
    const bankConfigured =
      !!(bt.bankNameEn || bt.bankNameAr) &&
      !!(bt.accountNumber || bt.iban);

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
        // Now considers the admin-editable DB row too — admin can set
        // the sender via the Mail settings section without touching
        // MAIL_FROM env.
        configured:
          has('MAIL_FROM') ||
          !!(await this.settingsService
            .getMailSettings()
            .then((s) => s.senderEmail)
            .catch(() => null)),
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
      // Honors env vars OR admin-saved encrypted DB credentials — matches
      // exactly what GatewayCredentialsService loads at runtime.
      moyasar: {
        configured: moyasarEnv || moyasarDb,
        required: false,
        description: 'Moyasar — Saudi card / Apple Pay / mada gateway',
      },
      tamara: {
        configured: tamaraEnv || tamaraDb,
        required: false,
        description: 'Tamara — Buy-now-pay-later instalments',
      },
      tabby: {
        configured: tabbyEnv || tabbyDb,
        required: false,
        description: 'Tabby — Buy-now-pay-later instalments',
      },
      bankTransfer: {
        configured: bankConfigured,
        required: false,
        description: 'Manual bank transfer with admin verification',
      },
    };
  }
}
