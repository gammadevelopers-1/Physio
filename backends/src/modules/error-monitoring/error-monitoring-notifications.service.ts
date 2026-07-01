import { Injectable, Logger } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../database';
import {
  users,
  userRoles,
  roles,
  ROLE_NAMES,
} from '../../database/schema';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { EmailService } from '../email/email.service';

export interface SentryAlertPayload {
  action: string;
  data?: {
    issue?: {
      id?: string | number;
      shortId?: string;
      title?: string;
      culprit?: string | null;
      level?: string;
      permalink?: string;
      project?: { slug?: string; name?: string };
      metadata?: { type?: string; value?: string };
      count?: number | string;
      userCount?: number;
    };
    event?: {
      title?: string;
      level?: string;
      web_url?: string;
      project?: { slug?: string };
    };
    triggered_rule?: string;
  };
}

/**
 * Fans Sentry-issued alert webhooks out to PhysioGuidance admins:
 *   - every ADMIN + SUPER_ADMIN gets an in-app notification (bell badge)
 *   - every ADMIN + SUPER_ADMIN gets an email summary with deep-link
 *
 * The webhook controller calls this AFTER verifying the HMAC signature,
 * so by the time we land here the payload is trusted to be from Sentry.
 *
 * In-app delivery respects each admin's own push preferences via
 * UserNotificationsService.createBulk (auto-filters disabled users).
 * Email delivery is best-effort — a single bad SMTP send won't block
 * the in-app fanout.
 */
@Injectable()
export class ErrorMonitoringNotificationsService {
  private readonly logger = new Logger(
    ErrorMonitoringNotificationsService.name,
  );

  constructor(
    private readonly userNotifications: UserNotificationsService,
    private readonly email: EmailService,
  ) {}

  async fanOut(payload: SentryAlertPayload): Promise<{
    notifiedUserIds: string[];
    emailsAttempted: number;
  }> {
    const summary = this.extractSummary(payload);
    if (!summary) {
      this.logger.debug(
        `Sentry webhook had no actionable issue/event payload — skipping fanout`,
      );
      return { notifiedUserIds: [], emailsAttempted: 0 };
    }

    const admins = await this.listAdminRecipients();
    if (admins.length === 0) {
      this.logger.warn(
        'Sentry alert received but no ADMIN/SUPER_ADMIN users to notify',
      );
      return { notifiedUserIds: [], emailsAttempted: 0 };
    }

    const adminIds = admins.map((a) => a.id);

    try {
      await this.userNotifications.createBulk(adminIds, {
        type: 'sentry_alert',
        title: `[Sentry] ${summary.title}`,
        message: summary.subtitle,
        link: '/dashboard/admin/settings?tab=system&panel=error-monitoring',
        entityType: 'sentry_issue',
        entityId: null,
      });
    } catch (err) {
      this.logger.warn(
        `In-app Sentry alert fanout failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    let emailsAttempted = 0;
    await Promise.all(
      admins.map(async (admin) => {
        if (!admin.email) return;
        emailsAttempted += 1;
        try {
          await this.email.sendSentryAlert(
            admin.email,
            admin.firstName ?? 'Admin',
            summary,
          );
        } catch (err) {
          this.logger.warn(
            `Sentry alert email to ${admin.email} failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }),
    );

    return { notifiedUserIds: adminIds, emailsAttempted };
  }

  private extractSummary(payload: SentryAlertPayload): {
    title: string;
    subtitle: string;
    level: string;
    permalink: string | null;
    triggeredRule: string | null;
  } | null {
    const issue = payload.data?.issue;
    const event = payload.data?.event;
    const source = issue ?? event;
    if (!source) return null;

    const title = source.title || 'New error in production';
    const level = source.level || 'error';
    const subtitleParts: string[] = [];
    if (issue?.culprit) subtitleParts.push(issue.culprit);
    if (issue?.metadata?.value) subtitleParts.push(issue.metadata.value);
    if (issue?.count !== undefined) {
      subtitleParts.push(`${issue.count} event${Number(issue.count) === 1 ? '' : 's'}`);
    }
    if (issue?.userCount !== undefined && issue.userCount > 0) {
      subtitleParts.push(`${issue.userCount} user${issue.userCount === 1 ? '' : 's'} affected`);
    }
    const subtitle = subtitleParts.length
      ? subtitleParts.join(' · ')
      : 'A production error was detected.';

    const permalink =
      (issue && 'permalink' in issue ? issue.permalink : undefined) ||
      (event && 'web_url' in event ? event.web_url : undefined) ||
      null;

    return {
      title,
      subtitle,
      level,
      permalink: permalink ?? null,
      triggeredRule: payload.data?.triggered_rule ?? null,
    };
  }

  private async listAdminRecipients(): Promise<
    Array<{ id: string; email: string; firstName: string | null }>
  > {
    const adminUserIds = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        inArray(roles.name, [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPER_ADMIN]),
      );

    const ids = Array.from(new Set(adminUserIds.map((r) => r.userId)));
    if (ids.length === 0) return [];

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
      })
      .from(users)
      .where(inArray(users.id, ids));

    return rows;
  }
}
