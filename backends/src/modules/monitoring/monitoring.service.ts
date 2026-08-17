import { Injectable, Logger } from '@nestjs/common';
import { protos, MetricServiceClient } from '@google-cloud/monitoring';
import { JobsClient, ExecutionsClient } from '@google-cloud/run';

/**
 * Admin-facing monitoring facade over GCP Cloud Monitoring + Cloud Run APIs.
 *
 * Every method is defensive: if the runtime SA lacks the required IAM role
 * (roles/monitoring.viewer + roles/run.developer are needed), the caller
 * gets a `{ iamGrantPending: true, ... }` payload instead of a 500 error.
 * That way the admin UI can render "IAM grant pending" placeholders
 * without any code change once the roles are actually granted.
 *
 * Responses are cached in-process for 60s to keep the Monitoring API
 * cost + latency down — the admin dashboard is refreshed every 30s but
 * two admins loading at the same time only trigger one upstream call.
 */
@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly projectId: string;
  private readonly region: string;
  private readonly metricClient: MetricServiceClient;
  private readonly jobsClient: JobsClient;
  private readonly executionsClient: ExecutionsClient;

  private static readonly CACHE_TTL_MS = 60_000;
  private cache = new Map<string, { at: number; value: unknown }>();

  private static readonly SERVICES = [
    { name: 'physioguidance-api', url: 'https://api.physioguidance.org/api/health/ready' },
    { name: 'physioguidance-web', url: 'https://physioguidance.org/' },
    { name: 'physioguidance-cms', url: 'https://cms.physioguidance.org/_health' },
    { name: 'physioguidance-api-worker', url: null }, // internal; probed via GCP metrics only
    { name: 'physioguidance-malware-scanner', url: null }, // Eventarc-triggered
  ];

  private static readonly JOB_NAMES = [
    'physio-job-backups-purge-clones',
    'physio-job-captions-generate',
    'physio-job-courses-completion',
    'physio-job-payments-cleanup',
    'physio-job-payments-tamara-retry',
    'physio-job-points-log-expired',
    'physio-job-points-sweep-holds',
    'physio-job-processing-cleanup',
    'physio-job-reports-schedule',
    'physio-job-scheduled-maintenance-tick',
    'physio-job-service-status-check',
    'physio-job-service-status-incident-suggestion',
    'physio-job-sessions-end-expired',
    'physio-job-sessions-mark-missed',
    'physio-job-sessions-reminder-notify',
    'physio-job-support-auto-close-resolved',
    'physio-job-support-auto-close-waiting',
    'physio-job-support-business-resume-sweep',
    'physio-job-support-csat-emails',
    'physio-job-support-priority-escalation',
    'physio-job-support-sla-breach',
    'physio-job-video-transcode',
    'physio-job-wcag-check',
    'physio-job-xapi-flush',
    'physio-job-zoom-sync',
  ];

  constructor() {
    this.projectId =
      process.env.GCP_PROJECT_ID || 'nelc-elearning-platform-479319';
    this.region = process.env.GCP_REGION || 'me-central2';
    this.metricClient = new MetricServiceClient();
    this.jobsClient = new JobsClient();
    this.executionsClient = new ExecutionsClient();
  }

  private cached<T>(key: string): T | null {
    const hit = this.cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > MonitoringService.CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    return hit.value as T;
  }

  private setCache(key: string, value: unknown) {
    this.cache.set(key, { at: Date.now(), value });
  }

  private isPermissionError(err: unknown): boolean {
    const code = (err as { code?: number })?.code;
    const message = (err as { message?: string })?.message ?? '';
    // gRPC PERMISSION_DENIED = 7, HTTP 403 also appears in some error shapes
    return code === 7 || /PERMISSION_DENIED|permission/i.test(message);
  }

  /**
   * Live in-band health check — hits each service's health endpoint from
   * this backend and reports up/down + latency. Complements the GCP
   * uptime checks (which run from external probes) with an internal
   * check that includes network hops through our VPC.
   */
  async servicesHealth(): Promise<{
    services: Array<{
      name: string;
      status: 'up' | 'down' | 'unknown';
      latencyMs: number | null;
      httpStatus: number | null;
      lastCheckedAt: string;
    }>;
  }> {
    const cached = this.cached<
      Awaited<ReturnType<MonitoringService['servicesHealth']>>
    >('services-health');
    if (cached) return cached;

    const now = new Date().toISOString();
    const results = await Promise.all(
      MonitoringService.SERVICES.map(async (s) => {
        if (!s.url) {
          return {
            name: s.name,
            status: 'unknown' as const,
            latencyMs: null,
            httpStatus: null,
            lastCheckedAt: now,
          };
        }
        const start = Date.now();
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(s.url, { signal: controller.signal });
          clearTimeout(timeout);
          const latencyMs = Date.now() - start;
          return {
            name: s.name,
            status: res.ok ? ('up' as const) : ('down' as const),
            latencyMs,
            httpStatus: res.status,
            lastCheckedAt: now,
          };
        } catch {
          return {
            name: s.name,
            status: 'down' as const,
            latencyMs: null,
            httpStatus: null,
            lastCheckedAt: now,
          };
        }
      }),
    );

    const payload = { services: results };
    this.setCache('services-health', payload);
    return payload;
  }

  /**
   * Per-job stats for the last N hours: total executions, successes,
   * failures, and the timestamp of the most recent execution.
   * Aggregated from the Cloud Monitoring metric
   * `run.googleapis.com/job/completed_execution_count` which carries a
   * `result` label of "succeeded" or "failed".
   */
  async jobsStats(hours = 24): Promise<{
    iamGrantPending?: boolean;
    windowHours: number;
    jobs: Array<{
      name: string;
      succeeded: number;
      failed: number;
      lastExecutionAt: string | null;
    }>;
  }> {
    const cacheKey = `jobs-stats-${hours}h`;
    const cached = this.cached<
      Awaited<ReturnType<MonitoringService['jobsStats']>>
    >(cacheKey);
    if (cached) return cached;

    try {
      const endTime = Date.now();
      const startTime = endTime - hours * 60 * 60 * 1000;

      const [series] = await this.metricClient.listTimeSeries({
        name: `projects/${this.projectId}`,
        filter:
          'metric.type="run.googleapis.com/job/completed_execution_count" AND resource.type="cloud_run_job"',
        interval: {
          startTime: { seconds: Math.floor(startTime / 1000) },
          endTime: { seconds: Math.floor(endTime / 1000) },
        },
        view: protos.google.monitoring.v3.ListTimeSeriesRequest.TimeSeriesView
          .FULL,
      });

      // Aggregate per job + result. Metric points are int64 counters
      // per minute — sum them for the window.
      const perJob = new Map<string, {
        succeeded: number;
        failed: number;
        lastAt: number | null;
      }>();
      for (const s of series ?? []) {
        const jobName = s.resource?.labels?.job_name ?? 'unknown';
        const result = s.metric?.labels?.result ?? 'unknown';
        const bucket = perJob.get(jobName) ?? {
          succeeded: 0,
          failed: 0,
          lastAt: null,
        };
        for (const p of s.points ?? []) {
          const val = Number(p.value?.int64Value ?? 0);
          if (result === 'succeeded') bucket.succeeded += val;
          else if (result === 'failed') bucket.failed += val;
          const endSec = Number(p.interval?.endTime?.seconds ?? 0);
          if (endSec > 0 && (bucket.lastAt == null || endSec * 1000 > bucket.lastAt)) {
            bucket.lastAt = endSec * 1000;
          }
        }
        perJob.set(jobName, bucket);
      }

      const jobs = MonitoringService.JOB_NAMES.map((name) => {
        const b = perJob.get(name) ?? { succeeded: 0, failed: 0, lastAt: null };
        return {
          name,
          succeeded: b.succeeded,
          failed: b.failed,
          lastExecutionAt: b.lastAt ? new Date(b.lastAt).toISOString() : null,
        };
      });

      const payload = { windowHours: hours, jobs };
      this.setCache(cacheKey, payload);
      return payload;
    } catch (err) {
      if (this.isPermissionError(err)) {
        this.logger.warn(
          'monitoring.viewer role not granted on api-runtime SA — jobsStats returning empty',
        );
        return {
          iamGrantPending: true,
          windowHours: hours,
          jobs: MonitoringService.JOB_NAMES.map((name) => ({
            name,
            succeeded: 0,
            failed: 0,
            lastExecutionAt: null,
          })),
        };
      }
      throw err;
    }
  }

  /**
   * Cloud SQL live metrics — CPU %, active connections, DB size.
   * All read from `cloudsql.googleapis.com/database/*` metrics.
   */
  async cloudSqlMetrics(): Promise<{
    iamGrantPending?: boolean;
    cpuPercent: number | null;
    connections: number | null;
    diskBytes: number | null;
    memoryPercent: number | null;
    lastCheckedAt: string;
  }> {
    const cached = this.cached<
      Awaited<ReturnType<MonitoringService['cloudSqlMetrics']>>
    >('cloudsql');
    if (cached) return cached;

    try {
      const endTime = Date.now();
      const startTime = endTime - 10 * 60 * 1000; // last 10 min

      const readMetric = async (type: string): Promise<number | null> => {
        try {
          const [series] = await this.metricClient.listTimeSeries({
            name: `projects/${this.projectId}`,
            filter: `metric.type="${type}"`,
            interval: {
              startTime: { seconds: Math.floor(startTime / 1000) },
              endTime: { seconds: Math.floor(endTime / 1000) },
            },
            view: protos.google.monitoring.v3.ListTimeSeriesRequest
              .TimeSeriesView.FULL,
          });
          const points = series?.[0]?.points ?? [];
          if (!points.length) return null;
          const latest = points[0];
          return (
            Number(latest.value?.doubleValue ?? latest.value?.int64Value ?? 0)
          );
        } catch (err) {
          if (this.isPermissionError(err)) throw err;
          return null;
        }
      };

      const [cpu, conn, disk, mem] = await Promise.all([
        readMetric('cloudsql.googleapis.com/database/cpu/utilization'),
        readMetric('cloudsql.googleapis.com/database/postgresql/num_backends'),
        readMetric('cloudsql.googleapis.com/database/disk/bytes_used'),
        readMetric('cloudsql.googleapis.com/database/memory/utilization'),
      ]);

      const payload = {
        cpuPercent: cpu != null ? Math.round(cpu * 100) : null,
        connections: conn != null ? Math.round(conn) : null,
        diskBytes: disk != null ? Math.round(disk) : null,
        memoryPercent: mem != null ? Math.round(mem * 100) : null,
        lastCheckedAt: new Date().toISOString(),
      };
      this.setCache('cloudsql', payload);
      return payload;
    } catch (err) {
      if (this.isPermissionError(err)) {
        return {
          iamGrantPending: true,
          cpuPercent: null,
          connections: null,
          diskBytes: null,
          memoryPercent: null,
          lastCheckedAt: new Date().toISOString(),
        };
      }
      throw err;
    }
  }

  /**
   * Redis (Memorystore) live metrics — memory usage %, connected clients,
   * ops/sec. Read from `redis.googleapis.com/stats/*`.
   */
  async redisMetrics(): Promise<{
    iamGrantPending?: boolean;
    memoryPercent: number | null;
    memoryBytes: number | null;
    connectedClients: number | null;
    opsPerSec: number | null;
    lastCheckedAt: string;
  }> {
    const cached = this.cached<
      Awaited<ReturnType<MonitoringService['redisMetrics']>>
    >('redis');
    if (cached) return cached;

    try {
      const endTime = Date.now();
      const startTime = endTime - 10 * 60 * 1000;

      const readMetric = async (type: string): Promise<number | null> => {
        try {
          const [series] = await this.metricClient.listTimeSeries({
            name: `projects/${this.projectId}`,
            filter: `metric.type="${type}"`,
            interval: {
              startTime: { seconds: Math.floor(startTime / 1000) },
              endTime: { seconds: Math.floor(endTime / 1000) },
            },
            view: protos.google.monitoring.v3.ListTimeSeriesRequest
              .TimeSeriesView.FULL,
          });
          const points = series?.[0]?.points ?? [];
          if (!points.length) return null;
          const latest = points[0];
          return Number(
            latest.value?.doubleValue ?? latest.value?.int64Value ?? 0,
          );
        } catch (err) {
          if (this.isPermissionError(err)) throw err;
          return null;
        }
      };

      const [memUsage, memBytes, clients, ops] = await Promise.all([
        readMetric('redis.googleapis.com/stats/memory/usage_ratio'),
        readMetric('redis.googleapis.com/stats/memory/usage'),
        readMetric('redis.googleapis.com/clients/connected'),
        readMetric('redis.googleapis.com/commands/processed_count'),
      ]);

      const payload = {
        memoryPercent: memUsage != null ? Math.round(memUsage * 100) : null,
        memoryBytes: memBytes != null ? Math.round(memBytes) : null,
        connectedClients: clients != null ? Math.round(clients) : null,
        opsPerSec: ops != null ? Math.round(ops) : null,
        lastCheckedAt: new Date().toISOString(),
      };
      this.setCache('redis', payload);
      return payload;
    } catch (err) {
      if (this.isPermissionError(err)) {
        return {
          iamGrantPending: true,
          memoryPercent: null,
          memoryBytes: null,
          connectedClients: null,
          opsPerSec: null,
          lastCheckedAt: new Date().toISOString(),
        };
      }
      throw err;
    }
  }

  /**
   * Bucket sizes for all 6 project buckets. Uses the Monitoring metric
   * `storage.googleapis.com/storage/total_bytes` which is updated once
   * per day (this is a GCS quirk, not a bug).
   */
  async bucketSizes(): Promise<{
    iamGrantPending?: boolean;
    buckets: Array<{ name: string; sizeBytes: number | null }>;
    lastCheckedAt: string;
  }> {
    const cached = this.cached<
      Awaited<ReturnType<MonitoringService['bucketSizes']>>
    >('buckets');
    if (cached) return cached;

    const bucketNames = [
      'physioguidance-backups',
      'physioguidance-cms',
      'physioguidance-private',
      'physioguidance-public',
      'physioguidance-quarantine',
      'physioguidance-trainers',
    ];

    try {
      const endTime = Date.now();
      const startTime = endTime - 48 * 60 * 60 * 1000; // 48h — daily granularity

      const [series] = await this.metricClient.listTimeSeries({
        name: `projects/${this.projectId}`,
        filter:
          'metric.type="storage.googleapis.com/storage/total_bytes" AND resource.type="gcs_bucket"',
        interval: {
          startTime: { seconds: Math.floor(startTime / 1000) },
          endTime: { seconds: Math.floor(endTime / 1000) },
        },
        view: protos.google.monitoring.v3.ListTimeSeriesRequest.TimeSeriesView
          .FULL,
      });

      const sizeByBucket = new Map<string, number>();
      for (const s of series ?? []) {
        const name = s.resource?.labels?.bucket_name;
        if (!name) continue;
        const latestPoint = s.points?.[0];
        const val = Number(latestPoint?.value?.doubleValue ?? 0);
        sizeByBucket.set(name, val);
      }

      const buckets = bucketNames.map((name) => ({
        name,
        sizeBytes: sizeByBucket.has(name)
          ? Math.round(sizeByBucket.get(name)!)
          : null,
      }));

      const payload = {
        buckets,
        lastCheckedAt: new Date().toISOString(),
      };
      this.setCache('buckets', payload);
      return payload;
    } catch (err) {
      if (this.isPermissionError(err)) {
        return {
          iamGrantPending: true,
          buckets: bucketNames.map((name) => ({ name, sizeBytes: null })),
          lastCheckedAt: new Date().toISOString(),
        };
      }
      throw err;
    }
  }

  /**
   * Uptime check results — latency + up/down over the last hour for
   * every configured uptime check on the project.
   */
  async uptimeStatus(): Promise<{
    iamGrantPending?: boolean;
    checks: Array<{
      name: string;
      isUp: boolean | null;
      latestLatencyMs: number | null;
      checkedFrom: number; // how many probe regions reported
    }>;
    lastCheckedAt: string;
  }> {
    const cached = this.cached<
      Awaited<ReturnType<MonitoringService['uptimeStatus']>>
    >('uptime');
    if (cached) return cached;

    try {
      const endTime = Date.now();
      const startTime = endTime - 60 * 60 * 1000;

      const [series] = await this.metricClient.listTimeSeries({
        name: `projects/${this.projectId}`,
        filter:
          'metric.type="monitoring.googleapis.com/uptime_check/check_passed"',
        interval: {
          startTime: { seconds: Math.floor(startTime / 1000) },
          endTime: { seconds: Math.floor(endTime / 1000) },
        },
        view: protos.google.monitoring.v3.ListTimeSeriesRequest.TimeSeriesView
          .FULL,
      });

      // Group by check_id → { passingProbes, totalProbes }
      const byCheck = new Map<
        string,
        { name: string; passing: number; total: number }
      >();
      for (const s of series ?? []) {
        const name = s.metric?.labels?.check_id ?? 'unknown';
        const latest = s.points?.[0];
        const passed = latest?.value?.boolValue === true;
        const b = byCheck.get(name) ?? { name, passing: 0, total: 0 };
        b.total += 1;
        if (passed) b.passing += 1;
        byCheck.set(name, b);
      }

      const checks = Array.from(byCheck.values()).map((c) => ({
        name: c.name,
        isUp: c.total > 0 ? c.passing === c.total : null,
        latestLatencyMs: null,
        checkedFrom: c.total,
      }));

      const payload = {
        checks,
        lastCheckedAt: new Date().toISOString(),
      };
      this.setCache('uptime', payload);
      return payload;
    } catch (err) {
      if (this.isPermissionError(err)) {
        return {
          iamGrantPending: true,
          checks: [],
          lastCheckedAt: new Date().toISOString(),
        };
      }
      throw err;
    }
  }
}
