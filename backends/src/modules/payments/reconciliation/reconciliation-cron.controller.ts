import {
  Controller,
  Post,
  Headers,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReconciliationCronService } from './reconciliation-cron.service';
import { InvoiceService } from '../services/invoice.service';
import { Public } from '../../auth/decorators/public.decorator';

/**
 * HTTP entry point for Cloud Scheduler. Cloud Scheduler authenticates the
 * request with an OIDC token in the Authorization header; in production we
 * also verify a shared secret in X-Cron-Token as a belt-and-braces check
 * in case the OIDC validation upstream gets misconfigured.
 *
 * Two endpoints, called by separate scheduler jobs at different times:
 *   POST /payments/reconciliation/cron/daily-scan      ~02:00 KSA
 *   POST /payments/reconciliation/cron/stale-reminders ~10:00 KSA
 *
 * Both return 200 with summary stats. They run synchronously — if a scan
 * takes 60s, Scheduler waits. That's fine for our scale; if it grows we
 * can move to a fire-and-forget BullMQ pattern.
 */
// Cloud Scheduler calls these endpoints without a user JWT (it authenticates
// with OIDC + a shared secret in X-Cron-Token). Without @Public() the global
// JwtAuthGuard rejects every request as 401 before assertToken() even runs.
// The shared-secret check inside each handler is what actually gates access.
@Public()
@Controller('payments/reconciliation/cron')
export class ReconciliationCronController {
  private readonly logger = new Logger(ReconciliationCronController.name);

  constructor(
    private readonly cron: ReconciliationCronService,
    private readonly invoiceService: InvoiceService,
  ) {}

  @Post('daily-scan')
  // Even with auth, throttle to defend against accidental Scheduler
  // misconfig firing every minute instead of every day.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async dailyScan(@Headers('x-cron-token') token: string) {
    this.assertToken(token);
    this.logger.log('Cron-triggered daily reconciliation scan starting');
    return this.cron.runDailyScan();
  }

  @Post('stale-reminders')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async staleReminders(@Headers('x-cron-token') token: string) {
    this.assertToken(token);
    this.logger.log('Cron-triggered stale escalation reminder sweep starting');
    return this.cron.runStaleReminderSweep();
  }

  @Post('abandoned-sweep')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async abandonedSweep(@Headers('x-cron-token') token: string) {
    this.assertToken(token);
    this.logger.log('Cron-triggered abandoned-payment sweep starting');
    return this.cron.runAbandonedPaymentSweep();
  }

  @Post('overdue-invoices')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async overdueInvoices(@Headers('x-cron-token') token: string) {
    this.assertToken(token);
    this.logger.log('Cron-triggered overdue-invoice sweep starting');
    return this.invoiceService.sweepOverdueInvoices();
  }

  /**
   * BNPL status-poll fallback (Tabby + Tamara). Called frequently (~every
   * 5 min) by Cloud Scheduler so payments stuck in pending/processing get
   * actively progressed when webhooks are missed. Cheap when nothing is
   * stuck — one DB read returning an empty set.
   *
   * Throttled higher than the other cron jobs because this one is meant
   * to fire frequently; the limit just guards against runaway misconfig.
   */
  @Post('bnpl-status-poll')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async bnplStatusPoll(@Headers('x-cron-token') token: string) {
    this.assertToken(token);
    return this.cron.runBnplStatusPoll();
  }

  private assertToken(provided: string | undefined): void {
    // Trim both sides. The secret in Secret Manager was created with a
    // trailing newline / carriage return (`openssl rand -hex 32` was piped
    // through `gcloud secrets create --data-file=-` and the shell appended
    // a newline). Cloud Run mounts the raw bytes, so the env value carries
    // the trailing whitespace; without trimming, any caller that strips its
    // copy (Cloud Scheduler does, after a recent infra script fix) would
    // 401-mismatch on something invisible.
    const expected = (process.env.RECONCILIATION_CRON_TOKEN || '').trim();
    const received = (provided || '').trim();
    // In development we let it through to make local testing easy. In any
    // other environment, the token must be set AND match.
    if (process.env.NODE_ENV === 'development' && !expected) {
      this.logger.warn(
        'RECONCILIATION_CRON_TOKEN is not set; allowing in development mode.',
      );
      return;
    }
    if (!expected) {
      throw new UnauthorizedException(
        'Cron endpoint is not configured — RECONCILIATION_CRON_TOKEN env var is missing on the server.',
      );
    }
    if (received !== expected) {
      throw new UnauthorizedException('Invalid cron token');
    }
  }
}
