import { Injectable, Logger } from '@nestjs/common';

/**
 * TA deactivation cron is no longer needed.
 * TAs are now fully managed by the Course Manager (manual control).
 * Thresholds are advisory only — no auto-activation or auto-deactivation.
 * Keeping this class as a no-op to avoid breaking the module registration.
 */
@Injectable()
export class TaDeactivationCronService {
  private readonly logger = new Logger(TaDeactivationCronService.name);
}
