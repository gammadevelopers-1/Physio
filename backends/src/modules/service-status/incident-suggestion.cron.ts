import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isCronExternalized } from '../../common/is-cron-externalized.helper';
import { and, eq, gte, isNull, like, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  adminNotifications,
  cronRuns,
  serviceStatusIncidents,
  tickets,
} from '../../database/schema';
import { DistributedLockService } from '../tasks/distributed-lock.service';

/**
 * Auto-incident suggestion.
 *
 * Every 5 min, looks at the last 10 min of new tickets and groups
 * them by category. If any category has THRESHOLD or more new
 * tickets — that's a strong signal something is broken — we drop an
 * admin notification suggesting "create an incident for X".
 *
 * Dedupe: same category within the WINDOW won't fire twice. We also
 * skip if there's already an unresolved incident referencing the
 * matching component (best-effort — we look for the category string
 * inside any active incident title).
 *
 * Intentionally low-friction: the cron NEVER auto-creates an
 * incident. It just nudges an admin so they can decide. False
 * positives cost a click-to-dismiss; missed real incidents cost a
 * real outage.
 */
const THRESHOLD = 5;
const RECENT_TICKETS_WINDOW_MIN = 10;
const SUGGESTION_DEDUPE_WINDOW_MIN = 60;
const CRON_NAME = 'incident_suggestion_check';

@Injectable()
export class IncidentSuggestionCron {
  private readonly logger = new Logger(IncidentSuggestionCron.name);

  constructor(private readonly lock: DistributedLockService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run(): Promise<void> {
    if (isCronExternalized('service-status.incident-suggestion')) return;
    // Distributed lock — multi-instance safe. Also protects against
    // multi-instance spamming: the SUGGESTION_DEDUPE_WINDOW check
    // downstream would catch duplicates but at a higher cost.
    await this.lock.withLock(
      'lock:cron:service-status.incident-suggestion',
      2 * 60_000,
      () => this.tracked(CRON_NAME, async () => {
      const since = new Date(
        Date.now() - RECENT_TICKETS_WINDOW_MIN * 60_000,
      );

      const groups = await db
        .select({
          category: tickets.category,
          count: sql<number>`count(*)::int`,
        })
        .from(tickets)
        .where(gte(tickets.createdAt, since))
        .groupBy(tickets.category)
        .having(sql`count(*) >= ${THRESHOLD}`);

      if (groups.length === 0) return;

      // Dedupe: pull recent suggestion titles so we don't spam.
      const dedupeSince = new Date(
        Date.now() - SUGGESTION_DEDUPE_WINDOW_MIN * 60_000,
      );
      const recentSuggestions = await db
        .select({ title: adminNotifications.title })
        .from(adminNotifications)
        .where(
          and(
            like(adminNotifications.title, 'Incident suggested:%'),
            gte(adminNotifications.createdAt, dedupeSince),
          ),
        );
      const recentCategories = new Set(
        recentSuggestions
          .map((s) => s.title.replace(/^Incident suggested:\s*/, '').trim())
          .filter(Boolean),
      );

      // Existing active incidents — if the title obviously matches
      // the category, treat this as "already known" and skip.
      const activeIncidents = await db
        .select({ titleEn: serviceStatusIncidents.titleEn })
        .from(serviceStatusIncidents)
        .where(isNull(serviceStatusIncidents.resolvedAt));
      const activeIncidentTitles = activeIncidents.map((i) =>
        i.titleEn.toLowerCase(),
      );

      for (const g of groups) {
        if (recentCategories.has(g.category)) continue;
        if (
          activeIncidentTitles.some((t) =>
            t.includes(g.category.toLowerCase()),
          )
        ) {
          continue;
        }

        const title = `Incident suggested: ${g.category}`;
        const description = `${g.count} tickets opened in the last ${RECENT_TICKETS_WINDOW_MIN} minutes are all categorised "${g.category}". This might be a platform-wide issue worth declaring as an incident.`;
        await db.insert(adminNotifications).values({
          type: 'warning',
          title,
          description,
          titleKey: 'notifications.service_status.incident_suggested.title',
          titleParams: { category: g.category },
          descriptionKey: 'notifications.service_status.incident_suggested.description',
          descriptionParams: {
            count: g.count,
            windowMin: RECENT_TICKETS_WINDOW_MIN,
            category: g.category,
          },
          link: '/dashboard/admin/settings?tab=service-status',
        });
        this.logger.log(
          `Suggested incident for category="${g.category}" (${g.count} tickets in ${RECENT_TICKETS_WINDOW_MIN}m)`,
        );
      }
    }),
    );
  }

  private async tracked(name: string, body: () => Promise<void>): Promise<void> {
    let runId: string | null = null;
    const startedAt = new Date();
    try {
      const [row] = await db
        .insert(cronRuns)
        .values({ cronName: name, startedAt, status: 'running' })
        .returning({ id: cronRuns.id });
      runId = row?.id ?? null;
    } catch {
      // Tracking row failed — proceed without it.
    }

    try {
      await body();
      if (runId) {
        const finishedAt = new Date();
        await db
          .update(cronRuns)
          .set({
            status: 'success',
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
          })
          .where(eq(cronRuns.id, runId));
      }
    } catch (err) {
      if (runId) {
        const finishedAt = new Date();
        await db
          .update(cronRuns)
          .set({
            status: 'error',
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            errorMessage: String(err).slice(0, 500),
          })
          .where(eq(cronRuns.id, runId));
      }
      this.logger.error(`Cron ${name} failed: ${(err as Error).message}`);
    }
  }
}
