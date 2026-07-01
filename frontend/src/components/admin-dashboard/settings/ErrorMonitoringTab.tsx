"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Bug,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ErrorMonitoringOverview,
  ErrorMonitoringPeriod,
  ErrorMonitoringTrendBucket,
  SentryIssueSummary,
  errorMonitoringApi,
} from "@/lib/api";
import { TabShell } from "./TabShell";

const PERIODS: ErrorMonitoringPeriod[] = ["24h", "7d", "30d"];

type StatusKey = ErrorMonitoringOverview["status"];

const STATUS_META: Record<
  StatusKey,
  { icon: React.ElementType; color: string; bg: string }
> = {
  ok: {
    icon: CheckCircle2,
    color: "text-[#16A34A]",
    bg: "bg-[#DCFCE7] text-[#16A34A]",
  },
  no_recent: {
    icon: CircleDot,
    color: "text-[#0EA5E9]",
    bg: "bg-[#E0F2FE] text-[#0369A1]",
  },
  errors_present: {
    icon: AlertOctagon,
    color: "text-[#DC2626]",
    bg: "bg-[#FEE2E2] text-[#DC2626]",
  },
  not_configured: {
    icon: ShieldAlert,
    color: "text-[#94A3B8]",
    bg: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
  },
  unknown: {
    icon: AlertTriangle,
    color: "text-[#F59E0B]",
    bg: "bg-[#FEF3C7] text-[#B45309]",
  },
};

const LEVEL_META: Record<
  string,
  { label: string; bg: string }
> = {
  fatal: { label: "Fatal", bg: "bg-[#FECACA] text-[#7F1D1D]" },
  error: { label: "Error", bg: "bg-[#FEE2E2] text-[#B91C1C]" },
  warning: { label: "Warning", bg: "bg-[#FEF3C7] text-[#B45309]" },
  info: { label: "Info", bg: "bg-[#DBEAFE] text-[#1D4ED8]" },
  debug: { label: "Debug", bg: "bg-[#E2E8F0] text-[#475569]" },
};

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ErrorMonitoringTab() {
  const t = useTranslations("adminDashboard.settingsPage.errorMonitoring");

  const [overview, setOverview] = useState<ErrorMonitoringOverview | null>(
    null,
  );
  const [issues, setIssues] = useState<SentryIssueSummary[]>([]);
  const [trend, setTrend] = useState<ErrorMonitoringTrendBucket[]>([]);
  const [period, setPeriod] = useState<ErrorMonitoringPeriod>("7d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(
    async (p: ErrorMonitoringPeriod, silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [ov, top, tr] = await Promise.all([
          errorMonitoringApi.getOverview(),
          errorMonitoringApi.getTopIssues(p, 10),
          errorMonitoringApi.getTrend(p),
        ]);
        setOverview(ov);
        setIssues(top);
        setTrend(tr);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("loadFailed"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void fetchAll(period);
  }, [period, fetchAll]);

  const statusMeta = useMemo(() => {
    if (!overview) return STATUS_META.unknown;
    return STATUS_META[overview.status] ?? STATUS_META.unknown;
  }, [overview]);

  const StatusIcon = statusMeta.icon;

  return (
    <TabShell
      title={t("title")}
      description={t("subtitle")}
      loading={loading && !overview}
      saving={false}
      dirty={false}
      onSave={() => {}}
      noSaveBar
      loadError={error}
    >
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-card)] p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                period === p
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {t(`periods.${p}`)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {overview?.dashboardUrl ? (
            <a
              href={overview.dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t("openSentry")}
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => fetchAll(period, true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            {t("refresh")}
          </button>
        </div>
      </div>

      {/* Status + counts */}
      {overview ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="lg:col-span-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
              {t("statusHeader")}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${statusMeta.bg.replace(/text-\[[^\]]+\]/g, "")}`}
              >
                <StatusIcon className={`w-5 h-5 ${statusMeta.color}`} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {t(`status.${overview.status}`)}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("lastError")}: {relativeTime(overview.lastEventAt)}
                </p>
              </div>
            </div>
          </div>

          <CountCard
            label={t("counts.last24h")}
            events={overview.counts.last24h.events}
            users={overview.counts.last24h.users}
          />
          <CountCard
            label={t("counts.last7d")}
            events={overview.counts.last7d.events}
            users={overview.counts.last7d.users}
          />
          <CountCard
            label={t("counts.last30d")}
            events={overview.counts.last30d.events}
            users={overview.counts.last30d.users}
          />
        </div>
      ) : null}

      {/* Not-configured banner */}
      {overview && !overview.configured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 flex-shrink-0 text-amber-600" />
            <div className="text-sm text-amber-900 dark:text-amber-200">
              <p className="font-semibold">{t("notConfigured.title")}</p>
              <p className="mt-1">{t("notConfigured.body")}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Trend chart */}
      {overview?.configured ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("trendTitle", { period: t(`periods.${period}`) })}
            </h3>
            <Activity className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </div>
          {trend.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--color-text-secondary)]">
              {t("trendEmpty")}
            </div>
          ) : (
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="emTrendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#dc2626" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="timestamp" hide />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-surface-card)",
                      fontSize: 12,
                    }}
                    formatter={(value) => [
                      String(value ?? 0),
                      t("eventsLabel"),
                    ]}
                    labelFormatter={(label) => {
                      try {
                        return new Date(String(label)).toLocaleString();
                      } catch {
                        return String(label ?? "");
                      }
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#dc2626"
                    strokeWidth={2}
                    fill="url(#emTrendGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : null}

      {/* Top issues */}
      {overview?.configured ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("topIssuesTitle")}
            </h3>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {t("topIssuesSubtitle", { period: t(`periods.${period}`) })}
            </span>
          </div>
          {issues.length === 0 ? (
            <EmptyIssues label={t("noIssues")} />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {issues.map((issue) => (
                <IssueRow key={issue.id} issue={issue} t={t} />
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {/* Footer note */}
      {overview?.configured ? (
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t("footerNote", {
            org: overview.orgSlug,
            project: overview.projectSlug,
          })}
        </p>
      ) : null}
    </TabShell>
  );
}

function CountCard({
  label,
  events,
  users,
}: {
  label: string;
  events: number;
  users: number;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
        {label}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-[var(--color-text-primary)]">
          {events.toLocaleString()}
        </span>
        <span className="text-xs text-[var(--color-text-secondary)]">
          events
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
        <Users className="h-3 w-3" />
        <span>{users.toLocaleString()} users affected</span>
      </div>
    </div>
  );
}

function IssueRow({
  issue,
  t,
}: {
  issue: SentryIssueSummary;
  t: ReturnType<typeof useTranslations>;
}) {
  const lvl = LEVEL_META[issue.level?.toLowerCase()] ?? LEVEL_META.error;
  return (
    <li className="px-4 py-3 hover:bg-[var(--color-surface-page)] transition-colors">
      <div className="flex items-start gap-3">
        <Bug className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-text-secondary)]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${lvl.bg}`}
            >
              {lvl.label}
            </span>
            <span className="font-mono text-xs text-[var(--color-text-secondary)]">
              {issue.shortId}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">
              · {relativeTime(issue.lastSeen)}
            </span>
          </div>
          <p className="mt-1 break-words text-sm font-medium text-[var(--color-text-primary)]">
            {issue.title}
          </p>
          {issue.culprit ? (
            <p className="mt-0.5 truncate font-mono text-xs text-[var(--color-text-secondary)]">
              {issue.culprit}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)]">
            <span>
              <strong className="text-[var(--color-text-primary)]">
                {issue.eventCount.toLocaleString()}
              </strong>{" "}
              {t("eventsLabel")}
            </span>
            <span>
              <strong className="text-[var(--color-text-primary)]">
                {issue.userCount.toLocaleString()}
              </strong>{" "}
              {t("usersLabel")}
            </span>
          </div>
        </div>
        {issue.permalink ? (
          <a
            href={issue.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-shrink-0 items-center gap-1 self-start rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
          >
            <ExternalLink className="h-3 w-3" />
            {t("view")}
          </a>
        ) : null}
      </div>
    </li>
  );
}

function EmptyIssues({ label }: { label: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-[#16A34A]" />
      <p className="mt-3 text-sm font-medium text-[var(--color-text-primary)]">
        {label}
      </p>
    </div>
  );
}

void Loader2;
