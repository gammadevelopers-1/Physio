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
    const expected = process.env.RECONCILIATION_CRON_TOKEN;
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
    if (provided !== expected) {
      throw new UnauthorizedException('Invalid cron token');
    }
  }
}
