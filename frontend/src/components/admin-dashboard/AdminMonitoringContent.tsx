"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  HardDrive,
  Loader2,
  RefreshCw,
  Server,
  XCircle,
  Zap,
} from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import {
  monitoringApi,
  MonitoringBuckets,
  MonitoringCloudSql,
  MonitoringJobsStats,
  MonitoringRedis,
  MonitoringServicesHealthResponse,
  MonitoringUptime,
} from "@/lib/api";
import { useAdminProfile } from "@/hooks/useAdminProfile";

const GCP_DASHBOARD_URL =
  "https://console.cloud.google.com/monitoring/dashboards?project=nelc-elearning-platform-479319";
const REFRESH_INTERVAL_MS = 30_000;

function humanBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export default function AdminMonitoringContent() {
  const locale = useLocale();
  const t = useTranslations("adminMonitoring");
  const isRTL = locale === "ar";
  const userData = useAdminProfile();

  const [services, setServices] = useState<MonitoringServicesHealthResponse | null>(null);
  const [jobs, setJobs] = useState<MonitoringJobsStats | null>(null);
  const [cloudSql, setCloudSql] = useState<MonitoringCloudSql | null>(null);
  const [redis, setRedis] = useState<MonitoringRedis | null>(null);
  const [buckets, setBuckets] = useState<MonitoringBuckets | null>(null);
  const [uptime, setUptime] = useState<MonitoringUptime | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, j, c, r, b, u] = await Promise.allSettled([
        monitoringApi.servicesHealth(),
        monitoringApi.jobsStats(24),
        monitoringApi.cloudSql(),
        monitoringApi.redis(),
        monitoringApi.buckets(),
        monitoringApi.uptime(),
      ]);
      if (s.status === "fulfilled") setServices(s.value);
      if (j.status === "fulfilled") setJobs(j.value);
      if (c.status === "fulfilled") setCloudSql(c.value);
      if (r.status === "fulfilled") setRedis(r.value);
      if (b.status === "fulfilled") setBuckets(b.value);
      if (u.status === "fulfilled") setUptime(u.value);
      setLastRefreshedAt(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const anyIamPending =
    jobs?.iamGrantPending ||
    cloudSql?.iamGrantPending ||
    redis?.iamGrantPending ||
    buckets?.iamGrantPending ||
    uptime?.iamGrantPending;

  return (
    <>
      <AdminNavbar admin={userData} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={userData} />
            </div>
            <AdminMobileSidebar admin={userData} />

            <div className="flex-1 min-w-0" dir={isRTL ? "rtl" : "ltr"}>
              {/* Header */}
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("subtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={GCP_DASHBOARD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t("openInGcp")}
                  </a>
                  <button
                    type="button"
                    onClick={() => void load()}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                    {t("refresh")}
                  </button>
                </div>
              </div>

              {lastRefreshedAt && (
                <p className="text-xs text-[var(--color-text-secondary)] mb-4">
                  {t("lastRefreshed")} {relativeTime(lastRefreshedAt.toISOString())}
                </p>
              )}

              {anyIamPending && (
                <div className="mb-6 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <div className="font-medium">{t("iamPendingTitle")}</div>
                    <div className="text-xs mt-1">{t("iamPendingBody")}</div>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex justify-center py-24">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Section 1 — Services health */}
                  <section>
                    <SectionHeader icon={Server} title={t("sectionServices")} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                      {(services?.services ?? []).map((s) => (
                        <ServiceCard key={s.name} service={s} />
                      ))}
                    </div>
                  </section>

                  {/* Section 2 — Uptime + jobs summary */}
                  <section>
                    <SectionHeader icon={Activity} title={t("sectionEvents")} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <UptimeCard uptime={uptime} />
                      <JobsSummaryCard jobs={jobs} />
                    </div>
                  </section>

                  {/* Section 3 — Background jobs table */}
                  <section>
                    <SectionHeader icon={Zap} title={t("sectionJobs")} />
                    <JobsTable jobs={jobs} />
                  </section>

                  {/* Section 4 — Resource pressure */}
                  <section>
                    <SectionHeader icon={Database} title={t("sectionResources")} />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      <CloudSqlCard data={cloudSql} />
                      <RedisCard data={redis} />
                      <BucketsCard data={buckets} />
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-[var(--color-primary)]" />
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-primary)]">
        {title}
      </h2>
    </div>
  );
}

function ServiceCard({ service: s }: { service: NonNullable<MonitoringServicesHealthResponse["services"]>[number] }) {
  const t = useTranslations("adminMonitoring");
  const statusMeta = {
    up: {
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-800",
      label: t("statusUp"),
    },
    down: {
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800",
      label: t("statusDown"),
    },
    unknown: {
      icon: Activity,
      color: "text-gray-500",
      bg: "bg-gray-50 dark:bg-gray-900/30 border-gray-300 dark:border-gray-800",
      label: t("statusUnknown"),
    },
  }[s.status];
  const Icon = statusMeta.icon;
  return (
    <div className={`rounded-xl border p-4 ${statusMeta.bg}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-xs font-medium text-[var(--color-text-secondary)] truncate">
          {s.name.replace("physioguidance-", "")}
        </div>
        <Icon className={`w-4 h-4 shrink-0 ${statusMeta.color}`} />
      </div>
      <div className={`text-sm font-semibold ${statusMeta.color}`}>{statusMeta.label}</div>
      <div className="text-xs text-[var(--color-text-secondary)] mt-1">
        {s.latencyMs != null ? `${s.latencyMs}ms` : "—"}
        {s.httpStatus != null ? ` · HTTP ${s.httpStatus}` : ""}
      </div>
    </div>
  );
}

function UptimeCard({ uptime }: { uptime: MonitoringUptime | null }) {
  const t = useTranslations("adminMonitoring");
  const upCount = uptime?.checks.filter((c) => c.isUp).length ?? 0;
  const totalCount = uptime?.checks.length ?? 0;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-4">
      <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
        {t("uptimeChecks")}
      </div>
      <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
        {totalCount > 0 ? `${upCount}/${totalCount}` : "—"}
      </div>
      <div className="text-xs text-[var(--color-text-secondary)] mt-1">
        {t("uptimeUp")}
      </div>
      {uptime?.iamGrantPending && (
        <div className="text-xs text-amber-600 mt-2">{t("iamPendingShort")}</div>
      )}
    </div>
  );
}

function JobsSummaryCard({ jobs }: { jobs: MonitoringJobsStats | null }) {
  const t = useTranslations("adminMonitoring");
  const totalSucceeded = jobs?.jobs.reduce((sum, j) => sum + j.succeeded, 0) ?? 0;
  const totalFailed = jobs?.jobs.reduce((sum, j) => sum + j.failed, 0) ?? 0;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-4">
      <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
        {t("jobsSummary24h")}
      </div>
      <div className="flex items-baseline gap-4">
        <div>
          <div className="text-2xl font-semibold text-green-600">{totalSucceeded}</div>
          <div className="text-xs text-[var(--color-text-secondary)]">{t("succeeded")}</div>
        </div>
        <div>
          <div className={`text-2xl font-semibold ${totalFailed > 0 ? "text-red-600" : "text-[var(--color-text-primary)]"}`}>
            {totalFailed}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">{t("failed")}</div>
        </div>
      </div>
      {jobs?.iamGrantPending && (
        <div className="text-xs text-amber-600 mt-2">{t("iamPendingShort")}</div>
      )}
    </div>
  );
}

function JobsTable({ jobs }: { jobs: MonitoringJobsStats | null }) {
  const t = useTranslations("adminMonitoring");
  if (!jobs) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-border-subtle)]">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">{t("jobName")}</th>
              <th className="text-right px-3 py-2 font-medium text-[var(--color-text-secondary)]">{t("succeeded")}</th>
              <th className="text-right px-3 py-2 font-medium text-[var(--color-text-secondary)]">{t("failed")}</th>
              <th className="text-right px-3 py-2 font-medium text-[var(--color-text-secondary)]">{t("lastRun")}</th>
            </tr>
          </thead>
          <tbody>
            {jobs.jobs.map((j) => (
              <tr key={j.name} className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 text-[var(--color-text-primary)] font-mono text-xs">
                  {j.name.replace("physio-job-", "")}
                </td>
                <td className="px-3 py-2 text-right text-green-700 dark:text-green-400">
                  {j.succeeded}
                </td>
                <td className={`px-3 py-2 text-right ${j.failed > 0 ? "text-red-600 font-semibold" : "text-[var(--color-text-secondary)]"}`}>
                  {j.failed}
                </td>
                <td className="px-3 py-2 text-right text-[var(--color-text-secondary)] text-xs">
                  {relativeTime(j.lastExecutionAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CloudSqlCard({ data }: { data: MonitoringCloudSql | null }) {
  const t = useTranslations("adminMonitoring");
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Database className="w-4 h-4 text-[var(--color-primary)]" />
        <div className="text-sm font-semibold">{t("cloudSql")}</div>
      </div>
      <div className="space-y-1.5 text-xs">
        <MetricRow label={t("cpu")} value={data?.cpuPercent != null ? `${data.cpuPercent}%` : "—"} />
        <MetricRow label={t("connections")} value={data?.connections ?? "—"} />
        <MetricRow label={t("memory")} value={data?.memoryPercent != null ? `${data.memoryPercent}%` : "—"} />
        <MetricRow label={t("dbSize")} value={humanBytes(data?.diskBytes ?? null)} />
      </div>
      {data?.iamGrantPending && (
        <div className="text-xs text-amber-600 mt-2">{t("iamPendingShort")}</div>
      )}
    </div>
  );
}

function RedisCard({ data }: { data: MonitoringRedis | null }) {
  const t = useTranslations("adminMonitoring");
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-[var(--color-primary)]" />
        <div className="text-sm font-semibold">{t("redis")}</div>
      </div>
      <div className="space-y-1.5 text-xs">
        <MetricRow label={t("memory")} value={data?.memoryPercent != null ? `${data.memoryPercent}%` : "—"} />
        <MetricRow label={t("memoryUsed")} value={humanBytes(data?.memoryBytes ?? null)} />
        <MetricRow label={t("connections")} value={data?.connectedClients ?? "—"} />
        <MetricRow label={t("opsPerSec")} value={data?.opsPerSec ?? "—"} />
      </div>
      {data?.iamGrantPending && (
        <div className="text-xs text-amber-600 mt-2">{t("iamPendingShort")}</div>
      )}
    </div>
  );
}

function BucketsCard({ data }: { data: MonitoringBuckets | null }) {
  const t = useTranslations("adminMonitoring");
  const total = data?.buckets.reduce((sum, b) => sum + (b.sizeBytes ?? 0), 0) ?? 0;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <HardDrive className="w-4 h-4 text-[var(--color-primary)]" />
        <div className="text-sm font-semibold">
          {t("storageBuckets")} — {humanBytes(total)}
        </div>
      </div>
      <div className="space-y-1.5 text-xs">
        {(data?.buckets ?? []).map((b) => (
          <MetricRow
            key={b.name}
            label={b.name.replace("physioguidance-", "")}
            value={humanBytes(b.sizeBytes)}
          />
        ))}
      </div>
      {data?.iamGrantPending && (
        <div className="text-xs text-amber-600 mt-2">{t("iamPendingShort")}</div>
      )}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[var(--color-text-secondary)]">{label}</span>
      <span className="font-mono text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}
