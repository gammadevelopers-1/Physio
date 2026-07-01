import { Injectable, Logger, BadRequestException } from '@nestjs/common';

type CachedValue<T> = { value: T; expiresAt: number };

export type ErrorMonitoringPeriod = '24h' | '7d' | '30d';

export interface SentryIssueSummary {
  id: string;
  shortId: string;
  title: string;
  culprit: string | null;
  level: string;
  status: string;
  eventCount: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
  project: string;
  metadata: {
    type?: string;
    value?: string;
    filename?: string;
    function?: string;
  };
}

export interface ErrorMonitoringOverview {
  configured: boolean;
  apiHost: string;
  orgSlug: string;
  projectSlug: string;
  dashboardUrl: string;
  issuesUrl: string;
  status: 'ok' | 'no_recent' | 'errors_present' | 'not_configured' | 'unknown';
  lastEventAt: string | null;
  counts: {
    last24h: { events: number; users: number };
    last7d: { events: number; users: number };
    last30d: { events: number; users: number };
  };
}

export interface ErrorMonitoringTrendBucket {
  timestamp: string;
  count: number;
}

interface SentryIssueRaw {
  id: string;
  shortId: string;
  title: string;
  culprit?: string | null;
  level: string;
  status: string;
  count: string | number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
  project?: { slug?: string };
  metadata?: {
    type?: string;
    value?: string;
    filename?: string;
    function?: string;
  };
}

/**
 * Read-only client for the Sentry REST API.
 *
 * Powers the admin Settings → Error Monitoring tab. Every method goes
 * through a 5-minute in-memory cache so the dashboard can refresh
 * aggressively without burning through Sentry's rate limits.
 *
 * Disabled-but-not-broken state: when SENTRY_API_TOKEN is unset the
 * service reports `configured: false` and every list endpoint returns
 * empty arrays. The admin UI uses this to render a friendly
 * "not configured" panel instead of crashing.
 */
@Injectable()
export class ErrorMonitoringService {
  private readonly logger = new Logger(ErrorMonitoringService.name);

  private readonly apiHost: string;
  private readonly apiToken: string | null;
  private readonly orgSlug: string;
  private readonly projectSlug: string;

  private readonly cache = new Map<string, CachedValue<unknown>>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor() {
    this.apiHost = process.env.SENTRY_API_HOST || 'de.sentry.io';
    this.apiToken = process.env.SENTRY_API_TOKEN || null;
    this.orgSlug = process.env.SENTRY_ORG || 'physioguidance';
    this.projectSlug = process.env.SENTRY_PROJECT || 'physioguidance-web';
  }

  isConfigured(): boolean {
    return !!this.apiToken;
  }

  private buildIssuesUrl(): string {
    return `https://${this.orgSlug}.sentry.io/issues/?project=&query=is:unresolved`;
  }

  private buildDashboardUrl(): string {
    return `https://${this.orgSlug}.sentry.io/projects/${this.projectSlug}/`;
  }

  private async cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.cache.get(key) as CachedValue<T> | undefined;
    if (hit && hit.expiresAt > now) return hit.value;
    const value = await fn();
    this.cache.set(key, { value, expiresAt: now + this.CACHE_TTL_MS });
    return value;
  }

  private async sentryFetch<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    if (!this.apiToken) {
      throw new BadRequestException(
        'Sentry API token is not configured on this server.',
      );
    }
    const url = `https://${this.apiHost}/api/0${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
          ...((init?.headers as Record<string, string>) || {}),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'network error';
      this.logger.warn(`Sentry API network error for ${path}: ${message}`);
      throw new Error(`Sentry API unreachable: ${message}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Sentry API ${res.status} for ${path}: ${text.slice(0, 200)}`);
      throw new Error(`Sentry API ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  /**
   * Fetch unresolved issues for the project, freshest first.
   * Sentry returns up to 100 per page; we cap at 25 for the dashboard.
   */
  async getTopIssues(
    period: ErrorMonitoringPeriod = '7d',
    limit = 10,
  ): Promise<SentryIssueSummary[]> {
    if (!this.isConfigured()) return [];

    const key = `top:${period}:${limit}`;
    return this.cached(key, async () => {
      const params = new URLSearchParams({
        limit: String(Math.min(limit, 25)),
        sort: 'freq',
        query: 'is:unresolved',
      });
      this.applyPeriod(params, period);
      const path = `/projects/${this.orgSlug}/${this.projectSlug}/issues/?${params.toString()}`;
      const issues = await this.sentryFetch<SentryIssueRaw[]>(path);
      return issues.map((i) => this.normalizeIssue(i));
    });
  }

  /**
   * Compute coarse trend buckets by binning the project's recent issues.
   * Sentry has a richer stats endpoint, but it requires the numeric
   * project ID and per-org rate limits — bucketing what we already
   * fetched gives a good-enough trendline for the dashboard.
   */
  async getTrend(
    period: ErrorMonitoringPeriod = '7d',
  ): Promise<ErrorMonitoringTrendBucket[]> {
    if (!this.isConfigured()) return [];

    const key = `trend:${period}`;
    return this.cached(key, async () => {
      const params = new URLSearchParams({
        limit: '100',
        sort: 'date',
        query: '',
      });
      this.applyPeriod(params, period);
      const path = `/projects/${this.orgSlug}/${this.projectSlug}/issues/?${params.toString()}`;
      const issues = await this.sentryFetch<SentryIssueRaw[]>(path);

      const now = Date.now();
      const windowMs = this.periodToMs(period);
      const bucketCount = period === '24h' ? 24 : 14;
      const bucketMs = windowMs / bucketCount;

      const buckets = Array.from({ length: bucketCount }, (_, idx) => ({
        timestamp: new Date(now - (bucketCount - idx) * bucketMs).toISOString(),
        count: 0,
      }));

      for (const issue of issues) {
        const ts = new Date(issue.lastSeen).getTime();
        const ageMs = now - ts;
        if (ageMs > windowMs) continue;
        const bucketIdx = Math.min(
          bucketCount - 1,
          Math.max(0, Math.floor((windowMs - ageMs) / bucketMs)),
        );
        buckets[bucketIdx].count += Number(issue.count) || 0;
      }

      return buckets;
    });
  }

  async getOverview(): Promise<ErrorMonitoringOverview> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        apiHost: this.apiHost,
        orgSlug: this.orgSlug,
        projectSlug: this.projectSlug,
        dashboardUrl: this.buildDashboardUrl(),
        issuesUrl: this.buildIssuesUrl(),
        status: 'not_configured',
        lastEventAt: null,
        counts: {
          last24h: { events: 0, users: 0 },
          last7d: { events: 0, users: 0 },
          last30d: { events: 0, users: 0 },
        },
      };
    }

    return this.cached('overview', async () => {
      let counts: ErrorMonitoringOverview['counts'] = {
        last24h: { events: 0, users: 0 },
        last7d: { events: 0, users: 0 },
        last30d: { events: 0, users: 0 },
      };
      let lastEventAt: string | null = null;
      let status: ErrorMonitoringOverview['status'] = 'unknown';

      try {
        const [last24, last7, last30] = await Promise.all([
          this.fetchAggregateCounts('24h'),
          this.fetchAggregateCounts('7d'),
          this.fetchAggregateCounts('30d'),
        ]);
        counts = {
          last24h: last24,
          last7d: last7,
          last30d: last30,
        };
        const recent = await this.getTopIssues('24h', 1);
        lastEventAt = recent[0]?.lastSeen ?? null;

        if (counts.last24h.events === 0) {
          status = 'ok';
        } else if (counts.last24h.events < 10) {
          status = 'no_recent';
        } else {
          status = 'errors_present';
        }
      } catch (err) {
        this.logger.warn(
          `Sentry overview fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        status = 'unknown';
      }

      return {
        configured: true,
        apiHost: this.apiHost,
        orgSlug: this.orgSlug,
        projectSlug: this.projectSlug,
        dashboardUrl: this.buildDashboardUrl(),
        issuesUrl: this.buildIssuesUrl(),
        status,
        lastEventAt,
        counts,
      };
    });
  }

  async getIssueDetail(issueId: string): Promise<unknown> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Sentry not configured');
    }
    const path = `/issues/${encodeURIComponent(issueId)}/`;
    return this.sentryFetch(path);
  }

  async resolveIssue(issueId: string): Promise<unknown> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Sentry not configured');
    }
    this.invalidate();
    const path = `/issues/${encodeURIComponent(issueId)}/`;
    return this.sentryFetch(path, {
      method: 'PUT',
      body: JSON.stringify({ status: 'resolved' }),
    });
  }

  /**
   * Drop the cache. Called after any write so the admin sees fresh data
   * immediately rather than a stale 5-minute snapshot.
   */
  invalidate(): void {
    this.cache.clear();
  }

  private async fetchAggregateCounts(
    period: ErrorMonitoringPeriod,
  ): Promise<{ events: number; users: number }> {
    const params = new URLSearchParams({
      limit: '100',
      query: '',
    });
    this.applyPeriod(params, period);
    const path = `/projects/${this.orgSlug}/${this.projectSlug}/issues/?${params.toString()}`;
    const issues = await this.sentryFetch<SentryIssueRaw[]>(path);
    let events = 0;
    let users = 0;
    for (const i of issues) {
      events += Number(i.count) || 0;
      users += Number(i.userCount) || 0;
    }
    return { events, users };
  }

  /**
   * Sentry's issues endpoint only accepts `''`, `'24h'`, or `'14d'` for the
   * `statsPeriod` query parameter. For our 7d/30d UI options we instead
   * supply explicit `start`/`end` ISO timestamps, which the same endpoint
   * accepts as a custom date range. 24h passes through unchanged.
   */
  private applyPeriod(
    params: URLSearchParams,
    period: ErrorMonitoringPeriod,
  ): void {
    if (period === '24h') {
      params.set('statsPeriod', '24h');
      return;
    }
    const now = new Date();
    const start = new Date(now.getTime() - this.periodToMs(period));
    params.set('start', start.toISOString());
    params.set('end', now.toISOString());
  }

  private periodToMs(period: ErrorMonitoringPeriod): number {
    switch (period) {
      case '24h':
        return 24 * 60 * 60 * 1000;
      case '7d':
        return 7 * 24 * 60 * 60 * 1000;
      case '30d':
        return 30 * 24 * 60 * 60 * 1000;
    }
  }

  private normalizeIssue(raw: SentryIssueRaw): SentryIssueSummary {
    return {
      id: raw.id,
      shortId: raw.shortId,
      title: raw.title,
      culprit: raw.culprit ?? null,
      level: raw.level,
      status: raw.status,
      eventCount: Number(raw.count) || 0,
      userCount: Number(raw.userCount) || 0,
      firstSeen: raw.firstSeen,
      lastSeen: raw.lastSeen,
      permalink: raw.permalink,
      project: raw.project?.slug ?? this.projectSlug,
      metadata: {
        type: raw.metadata?.type,
        value: raw.metadata?.value,
        filename: raw.metadata?.filename,
        function: raw.metadata?.function,
      },
    };
  }
}
