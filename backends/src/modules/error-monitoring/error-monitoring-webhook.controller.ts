import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { ErrorMonitoringService } from './error-monitoring.service';
import {
  ErrorMonitoringNotificationsService,
  SentryAlertPayload,
} from './error-monitoring-notifications.service';
import { Public } from '../auth/decorators';

/**
 * Webhook receiver for Sentry alert rules.
 *
 * Authentication is HMAC-only (no JwtAuthGuard) — Sentry signs every
 * POST with the Internal Integration's client secret. The CSRF
 * middleware in main.ts already skips webhook routes.
 *
 * Path matches what was registered when creating the Sentry Internal
 * Integration: `https://api.physioguidance.org/api/webhooks/sentry/alert`.
 */
@Public()
@SkipThrottle()
@Controller('webhooks/sentry')
export class ErrorMonitoringWebhookController {
  private readonly logger = new Logger(ErrorMonitoringWebhookController.name);
  private readonly clientSecret: string;

  constructor(
    private readonly errorMonitoring: ErrorMonitoringService,
    private readonly notifications: ErrorMonitoringNotificationsService,
  ) {
    this.clientSecret = process.env.SENTRY_WEBHOOK_SECRET || '';
  }

  @Post('alert')
  @HttpCode(202)
  async receiveAlert(
    @Req() req: Request,
    @Headers('sentry-hook-signature') signature: string | undefined,
    @Headers('sentry-hook-resource') resource: string | undefined,
  ): Promise<{ accepted: boolean; reason?: string }> {
    if (!this.clientSecret) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          'SENTRY_WEBHOOK_SECRET missing in production — rejecting webhook',
        );
        return { accepted: false, reason: 'not_configured' };
      }
      this.logger.warn(
        'SENTRY_WEBHOOK_SECRET unset (non-prod) — accepting without signature check',
      );
    }

    const body = req.body as SentryAlertPayload;
    if (!body || typeof body !== 'object') {
      return { accepted: false, reason: 'invalid_body' };
    }

    if (this.clientSecret) {
      const ok = this.verifySignature(req, signature);
      if (!ok) {
        this.logger.warn(
          `Sentry webhook signature mismatch (resource=${resource ?? 'unknown'})`,
        );
        return { accepted: false, reason: 'bad_signature' };
      }
    }

    // Drop the in-memory dashboard cache so the next admin refresh
    // reflects the just-arrived event without waiting 5 minutes.
    this.errorMonitoring.invalidate();

    if (resource !== 'issue' && resource !== 'error' && resource !== 'event_alert') {
      return { accepted: true };
    }

    const result = await this.notifications.fanOut(body);
    this.logger.log(
      `Sentry alert fanned out — admins=${result.notifiedUserIds.length} emails=${result.emailsAttempted} resource=${resource}`,
    );

    return { accepted: true };
  }

  private verifySignature(
    req: Request,
    received: string | undefined,
  ): boolean {
    if (!received) return false;

    const raw =
      (req as Request & { rawBody?: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');

    const expected = createHmac('sha256', this.clientSecret)
      .update(raw)
      .digest('hex');

    try {
      return timingSafeEqual(
        Buffer.from(received, 'hex'),
        Buffer.from(expected, 'hex'),
      );
    } catch {
      return false;
    }
  }
}
