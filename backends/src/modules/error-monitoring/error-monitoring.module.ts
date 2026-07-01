import { Module } from '@nestjs/common';
import { ErrorMonitoringController } from './error-monitoring.controller';
import { ErrorMonitoringService } from './error-monitoring.service';
import { ErrorMonitoringWebhookController } from './error-monitoring-webhook.controller';
import { ErrorMonitoringNotificationsService } from './error-monitoring-notifications.service';
import { AuthModule } from '../auth/auth.module';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';

/**
 * Sentry-backed error monitoring.
 *   - Admin tab reads aggregated counts + top issues via REST API.
 *   - Sentry alert rules POST to /webhooks/sentry/alert; the webhook
 *     controller verifies the HMAC signature and fans out a notification
 *     to every admin + super-admin (email + in-app bell).
 *
 * EmailService is provided by the @Global EmailModule, so it is
 * available for injection without importing the module here.
 */
@Module({
  imports: [AuthModule, UserNotificationsModule],
  controllers: [ErrorMonitoringController, ErrorMonitoringWebhookController],
  providers: [ErrorMonitoringService, ErrorMonitoringNotificationsService],
  exports: [ErrorMonitoringService],
})
export class ErrorMonitoringModule {}
