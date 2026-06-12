"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { supportApi } from "@/lib/api";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  TrendingDown,
  TrendingUp,
  Users as UsersIcon,
  Activity,
  Cog,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FilePlus,
  MessageSquare,
  Lock,
  UserCheck,
  ArrowUp,
  CircleCheckBig,
  XOctagon,
  RotateCcw,
  ShieldCheck,
  Hourglass,
} from "lucide-react";

type AuditTrailResponse = Awaited<
  ReturnType<typeof supportApi.getSupportAuditTrail>
>;

type OverviewResponse = Awaited<ReturnType<typeof supportApi.getSupportOverview>>;

// Admin Support Overview tab — single panel pulling all 7 client-requested
// metrics + at-risk list + activity feed + 7d trends + cron health from
// one endpoint. Auto-refreshes every 60s while the tab is visible so an
// admin watching the page sees fresh numbers without manually reloading.
const SupportOverviewTab = () => {
  const t = useTranslations("adminDashboard.supportPage.overview");
  const router = useRouter();
  const locale = useLocale();
  // Helper to build the in-tab deep-link. Pushing to the same admin
  // support route with ?tab=tickets switches the tab; the AdminTicketsTab
  // reads filter / priority / category / assigneeId / filter params on
  // first render. Cards always navigate via push so back-button works.
  const ticketsHref = useCallback(
    (params: Record<string, string>) => {
      const qs = new URLSearchParams({ tab: "tickets", ...params });
      return `/${locale}/dashboard/admin/support?${qs.toString()}`;
    },
    [locale],
  );
  const ticketDetailHref = useCallback(
    (id: string) => `/${locale}/dashboard/admin/support/tickets/${id}`,
    [locale],
  );
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Date range for the Health metrics block. The "current open"
  // numbers above stay live regardless — only avg FRT / TTR / SLA %
  // / escalations / created-trend respond to this.
  type RangeKey = "7d" | "30d" | "custom";
  const [range, setRange] = useState<RangeKey>("7d");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const { dateFrom, dateTo } = (() => {
    if (range === "custom") {
      return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
    }
    const days = range === "30d" ? 30 : 7;
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
  })();

  const fetchOverview = useCallback(async () => {
    try {
      const res = await supportApi.getSupportOverview({ dateFrom, dateTo });
      setData(res);
      setError(null);
      setLastFetched(new Date());
    } catch {
      setError(t("loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t, dateFrom, dateTo]);

  useEffect(() => {
    void fetchOverview();
    const interval = setInterval(() => {
      // Pause polling when the tab isn't visible so a sleeping admin
      // doesn't keep the backend honest. Resumes on visibilitychange.
      if (document.visibilityState === "visible") {
        void fetchOverview();
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 text-center text-[var(--color-text-secondary)]">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const health = data.health;
  const slaTone: "success" | "warning" | "danger" =
    health.slaCompliancePct >= 90
      ? "success"
      : health.slaCompliancePct >= 70
        ? "warning"
        : "danger";
  const escalationTone: "neutral" | "warning" | "danger" =
    health.escalationCount === 0
      ? "neutral"
      : health.escalationCount > 10
        ? "danger"
        : "warning";

  return (
    <div className="space-y-6">
      {/* Cron health strip — small status pills for each background job */}
      <CronHealthStrip cronHealth={data.cronHealth} t={t} />

      {/* Top KPI cards: 7 client-requested numbers in a grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard
          label={t("openTickets")}
          value={data.openTickets}
          icon={Inbox}
          tone="neutral"
          delta={data.trends.createdDelta}
          deltaLabel={t("vsLastWeek")}
          onClick={() =>
            router.push(
              ticketsHref({ status: "new,in_progress,on_hold" }),
            )
          }
        />
        <KpiCard
          label={t("awaitingResponse")}
          value={data.awaitingResponse}
          icon={Clock}
          tone={data.awaitingResponse > 0 ? "warning" : "neutral"}
          onClick={() =>
            router.push(ticketsHref({ filter: "awaiting" }))
          }
        />
        <KpiCard
          label={t("overdueTickets")}
          value={data.overdueTickets}
          icon={AlertTriangle}
          tone={data.overdueTickets > 0 ? "danger" : "neutral"}
          onClick={() =>
            router.push(ticketsHref({ filter: "overdue" }))
          }
        />
        <KpiCard
          label={t("csatScore")}
          value={data.csat.averageScore.toFixed(1)}
          suffix="/5"
          icon={CheckCircle2}
          tone={
            data.csat.averageScore >= 4
              ? "success"
              : data.csat.averageScore >= 3
                ? "warning"
                : "danger"
          }
          subLabel={t("csatResponses", { count: data.csat.responseCount })}
        />
      </div>

      {/* Health metrics block — window-scoped to the date range below */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t("health.title")}
            </h2>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              {t("health.sampleSize", { count: health.sampleSize })}
            </p>
          </div>
          <RangePicker
            range={range}
            customFrom={customFrom}
            customTo={customTo}
            onChange={setRange}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            t={t}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label={t("health.avgFrt")}
            value={formatMinutes(health.avgFrtMinutes)}
            icon={Clock}
            tone={
              health.avgFrtMinutes === null
                ? "neutral"
                : health.avgFrtMinutes <= 60
                  ? "success"
                  : health.avgFrtMinutes <= 240
                    ? "warning"
                    : "danger"
            }
            subLabel={t("health.businessHoursAware")}
          />
          <KpiCard
            label={t("health.avgTtr")}
            value={formatMinutes(health.avgTtrMinutes)}
            icon={Hourglass}
            tone={
              health.avgTtrMinutes === null
                ? "neutral"
                : health.avgTtrMinutes <= 480
                  ? "success"
                  : health.avgTtrMinutes <= 1440
                    ? "warning"
                    : "danger"
            }
            subLabel={t("health.businessHoursAware")}
          />
          <KpiCard
            label={t("health.slaCompliance")}
            value={health.slaCompliancePct}
            suffix="%"
            icon={ShieldCheck}
            tone={slaTone}
            subLabel={t(`health.slaTone.${slaTone}`)}
          />
          <KpiCard
            label={t("health.escalations")}
            value={health.escalationCount}
            icon={ArrowUp}
            tone={escalationTone}
            subLabel={t("health.escalationsHint")}
          />
        </div>
      </div>

      {/* Pending team requests reminder */}
      {data.pendingTeamRequests > 0 && (
        <button
          type="button"
          onClick={() =>
            router.push(
              `/${locale}/dashboard/admin/support?tab=team-requests`,
            )
          }
          className="w-full flex items-center justify-between p-4 bg-[#FEF3C7] border border-[#FDE68A] rounded-2xl hover:border-[#F59E0B] text-start"
        >
          <div className="flex items-center gap-3">
            <UsersIcon className="w-5 h-5 text-[#92400E]" />
            <div>
              <p className="text-sm font-semibold text-[#7C2D12]">
                {t("pendingTeamRequests", { count: data.pendingTeamRequests })}
              </p>
              <p className="text-xs text-[#92400E]">
                {t("pendingTeamRequestsHint")}
              </p>
            </div>
          </div>
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By priority */}
        <Card title={t("ticketsByPriority")}>
          <PriorityBars
            byPriority={data.byPriority}
            t={t}
            onRowClick={(priority) =>
              router.push(ticketsHref({ priority }))
            }
          />
        </Card>

        {/* By category */}
        <Card title={t("ticketsByCategory")}>
          {data.byCategory.length === 0 ? (
            <EmptyState text={t("noTicketsByCategory")} />
          ) : (
            <div className="flex flex-col gap-2">
              {data.byCategory.map((row) => (
                <button
                  key={row.category}
                  type="button"
                  onClick={() =>
                    router.push(ticketsHref({ category: row.category }))
                  }
                  className="flex items-center justify-between text-sm px-2 py-1 -mx-2 rounded hover:bg-[var(--color-border-subtle)] text-start"
                >
                  <span className="text-[var(--color-text-primary)] capitalize">
                    {row.category}
                  </span>
                  <span className="text-[var(--color-text-secondary)] font-medium tabular-nums">
                    {row.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Agent workload distribution — includes idle agents so an
            admin sees the full spread, not just the loaded ones */}
        <Card title={t("agentWorkload")} subtitle={t("workloadSubtitle")}>
          {data.agentDistribution.length === 0 ? (
            <EmptyState text={t("noActiveAgents")} />
          ) : (
            <AgentDistributionBars
              rows={data.agentDistribution}
              t={t}
              onRowClick={(agentId) =>
                router.push(ticketsHref({ assigneeId: agentId }))
              }
            />
          )}
        </Card>

        {/* At-risk in next 30 min */}
        <Card
          title={t("atRiskTitle")}
          subtitle={t("atRiskSubtitle")}
          accent={data.atRisk.length > 0 ? "danger" : "neutral"}
        >
          {data.atRisk.length === 0 ? (
            <EmptyState text={t("noAtRisk")} />
          ) : (
            <div className="flex flex-col gap-2">
              {data.atRisk.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => router.push(ticketDetailHref(row.id))}
                  className="flex items-center justify-between gap-2 px-3 py-2 border border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary)] text-start"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--color-primary)]">
                      {row.referenceNumber}
                    </p>
                    <p className="text-sm text-[var(--color-text-primary)] truncate">
                      {row.subject}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">
                      {row.assigneeName
                        ? t("assignedTo", { name: row.assigneeName })
                        : t("unassigned")}{" "}
                      · {row.target.toUpperCase()}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#991B1B] bg-[#FEE2E2] px-2 py-1 rounded">
                    {t("minutesLeft", { count: row.minutesRemaining })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Audit trail — paginated, every meaningful support action */}
      <AuditTrailSection
        t={t}
        onOpenTicket={(id) => router.push(ticketDetailHref(id))}
      />
    </div>
  );
};

/* ─── Sub-components ─── */

function Card({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: "neutral" | "danger";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`p-5 bg-[var(--color-surface-card)] rounded-2xl border ${
        accent === "danger"
          ? "border-[#FCA5A5]"
          : "border-[var(--color-border)]"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {title}
        </h3>
        {subtitle && (
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function KpiCard({
  label,
  value,
  suffix,
  icon: Icon,
  tone,
  delta,
  deltaLabel,
  subLabel,
  onClick,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "neutral" | "success" | "warning" | "danger";
  delta?: number;
  deltaLabel?: string;
  subLabel?: string;
  onClick?: () => void;
}) {
  const toneCls =
    tone === "success"
      ? "bg-[#DCFCE7] text-[#15803D]"
      : tone === "warning"
        ? "bg-[#FEF3C7] text-[#92400E]"
        : tone === "danger"
          ? "bg-[#FEE2E2] text-[#991B1B]"
          : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
  const deltaPositive = (delta ?? 0) > 0;
  const deltaNegative = (delta ?? 0) < 0;
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`p-4 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] text-start w-full ${
        onClick
          ? "hover:border-[var(--color-primary)] hover:shadow-sm transition-all cursor-pointer"
          : ""
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex p-1.5 rounded-md ${toneCls}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        {delta !== undefined && delta !== 0 && (
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-medium ${
              deltaPositive
                ? "text-[#991B1B]"
                : deltaNegative
                  ? "text-[#15803D]"
                  : "text-[var(--color-text-secondary)]"
            }`}
          >
            {deltaPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {Math.abs(delta)}
          </span>
        )}
      </div>
      <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">
        {label}
      </p>
      <p className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">
        {value}
        {suffix && (
          <span className="text-sm font-medium text-[var(--color-text-secondary)] ms-0.5">
            {suffix}
          </span>
        )}
      </p>
      {(subLabel || deltaLabel) && (
        <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
          {subLabel || deltaLabel}
        </p>
      )}
    </Wrapper>
  );
}

function PriorityBars({
  byPriority,
  t,
  onRowClick,
}: {
  byPriority: Record<string, number>;
  t: ReturnType<typeof useTranslations>;
  onRowClick?: (priority: string) => void;
}) {
  const total = Object.values(byPriority).reduce((a, b) => a + b, 0);
  const rows = [
    { key: "high", count: byPriority.high || 0, color: "bg-[#EF4444]" },
    { key: "medium", count: byPriority.medium || 0, color: "bg-[#F59E0B]" },
    { key: "low", count: byPriority.low || 0, color: "bg-[#10B981]" },
  ];
  if (total === 0) {
    return <EmptyState text={t("noTicketsByPriority")} />;
  }
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const pct = total > 0 ? (r.count / total) * 100 : 0;
        const Wrapper = onRowClick ? "button" : "div";
        return (
          <Wrapper
            key={r.key}
            onClick={onRowClick ? () => onRowClick(r.key) : undefined}
            className={`text-start w-full ${onRowClick ? "hover:opacity-80 cursor-pointer" : ""}`}
          >
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[var(--color-text-primary)] capitalize">
                {t(`priority_${r.key}`)}
              </span>
              <span className="text-[var(--color-text-secondary)] tabular-nums">
                {r.count}
              </span>
            </div>
            <div className="w-full h-2 bg-[var(--color-border-subtle)] rounded">
              <div
                className={`h-2 rounded ${r.color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
}

function AgentWorkloadBars({
  rows,
  t,
  onRowClick,
}: {
  rows: { agentId: string; agentName: string; activeCount: number }[];
  t: ReturnType<typeof useTranslations>;
  onRowClick?: (agentId: string) => void;
}) {
  const max = Math.max(...rows.map((r) => r.activeCount), 1);
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const pct = (r.activeCount / max) * 100;
        const Wrapper = onRowClick ? "button" : "div";
        return (
          <Wrapper
            key={r.agentId}
            onClick={onRowClick ? () => onRowClick(r.agentId) : undefined}
            className={`text-start w-full ${onRowClick ? "hover:opacity-80 cursor-pointer" : ""}`}
          >
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[var(--color-text-primary)] truncate">
                {r.agentName}
              </span>
              <span className="text-[var(--color-text-secondary)] tabular-nums">
                {t("activeTickets", { count: r.activeCount })}
              </span>
            </div>
            <div className="w-full h-2 bg-[var(--color-border-subtle)] rounded">
              <div
                className="h-2 rounded bg-[var(--color-primary)]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
}

// Distribution flavour of the workload card: shows the full SUPPORT
// roster, idle agents included (count = 0). Highlights overloaded
// outliers (>= 1.5× the median) in danger tone so an admin spots
// rebalancing opportunities at a glance.
function AgentDistributionBars({
  rows,
  t,
  onRowClick,
}: {
  rows: {
    agentId: string;
    agentName: string;
    supportSubRole: "supervisor" | "agent" | null;
    activeCount: number;
  }[];
  t: ReturnType<typeof useTranslations>;
  onRowClick?: (agentId: string) => void;
}) {
  const max = Math.max(...rows.map((r) => r.activeCount), 1);
  const nonZeroCounts = rows
    .map((r) => r.activeCount)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  const median =
    nonZeroCounts.length === 0
      ? 0
      : nonZeroCounts[Math.floor(nonZeroCounts.length / 2)];
  const overloadThreshold = median > 0 ? median * 1.5 : Infinity;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const pct = (r.activeCount / max) * 100;
        const idle = r.activeCount === 0;
        const overloaded = r.activeCount >= overloadThreshold;
        const barClass = idle
          ? "bg-[var(--color-border)]"
          : overloaded
            ? "bg-[#EF4444]"
            : "bg-[var(--color-primary)]";
        const Wrapper = onRowClick ? "button" : "div";
        return (
          <Wrapper
            key={r.agentId}
            onClick={onRowClick ? () => onRowClick(r.agentId) : undefined}
            className={`text-start w-full ${onRowClick ? "hover:opacity-80 cursor-pointer" : ""}`}
          >
            <div className="flex justify-between text-xs mb-1 gap-2">
              <span className="text-[var(--color-text-primary)] truncate inline-flex items-center gap-1.5">
                {r.agentName}
                {r.supportSubRole === "supervisor" && (
                  <span className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#6D28D9]">
                    {t("supervisorBadge")}
                  </span>
                )}
                {idle && (
                  <span className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                    {t("idleBadge")}
                  </span>
                )}
                {overloaded && (
                  <span className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#991B1B]">
                    {t("overloadedBadge")}
                  </span>
                )}
              </span>
              <span className="text-[var(--color-text-secondary)] tabular-nums">
                {t("activeTickets", { count: r.activeCount })}
              </span>
            </div>
            <div className="w-full h-2 bg-[var(--color-border-subtle)] rounded">
              <div
                className={`h-2 rounded ${barClass}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
}

// Date-range pill row for the Health metrics block. `custom` reveals
// two native date inputs that only fire the API call once both bounds
// are set, so a half-typed date doesn't blank the dashboard.
function RangePicker({
  range,
  customFrom,
  customTo,
  onChange,
  onCustomFromChange,
  onCustomToChange,
  t,
}: {
  range: "7d" | "30d" | "custom";
  customFrom: string;
  customTo: string;
  onChange: (next: "7d" | "30d" | "custom") => void;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const options: { key: "7d" | "30d" | "custom"; label: string }[] = [
    { key: "7d", label: t("health.range7d") },
    { key: "30d", label: t("health.range30d") },
    { key: "custom", label: t("health.rangeCustom") },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-card)] p-0.5">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              range === o.key
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {range === "custom" && (
        <div className="inline-flex items-center gap-1.5">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            aria-label={t("health.rangeFromLabel")}
            className="px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-surface-card)] text-[var(--color-text-primary)]"
          />
          <span className="text-xs text-[var(--color-text-secondary)]">→</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            aria-label={t("health.rangeToLabel")}
            className="px-2 py-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-surface-card)] text-[var(--color-text-primary)]"
          />
        </div>
      )}
    </div>
  );
}

// Resolves a cron name to a display label, falling back to a humanized
// version of the raw DB name if i18n hasn't caught up yet. Prevents
// raw key paths like "adminDashboard.supportPage.overview.cron_x"
// leaking into the UI when a new cron registers itself.
function humanizeCronName(
  name: string,
  t: ReturnType<typeof useTranslations>,
): string {
  try {
    const translated = t(`cron_${name}`);
    if (translated && !translated.startsWith("adminDashboard")) {
      return translated;
    }
  } catch {
    /* fall through to humanized name */
  }
  return name
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Same formatter the snapshot widget uses — minutes → 45m / 2.5h / 1.5d
function formatMinutes(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function CronHealthStrip({
  cronHealth,
  t,
}: {
  cronHealth: {
    name: string;
    lastStartedAt: string | null;
    status: string;
    durationMs: number | null;
    errorMessage?: string | null;
  }[];
  t: ReturnType<typeof useTranslations>;
}) {
  if (cronHealth.length === 0) return null;
  // Order the strip so the most-important crons (SLA + breach detection)
  // appear left, even if the DB happens to return them mid-list. Unknown
  // names fall to the end so the layout stays stable.
  const ORDER = [
    "SLA_BREACH_CHECK",
    "PRIORITY_ESCALATION",
    "CSAT_EMAIL_SEND",
    "BUSINESS_RESUME_SWEEP",
    "AUTO_CLOSE_RESOLVED",
    "AUTO_CLOSE_WAITING_STUDENT",
  ];
  const sorted = [...cronHealth].sort((a, b) => {
    const ai = ORDER.indexOf(a.name);
    const bi = ORDER.indexOf(b.name);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const succeededCount = cronHealth.filter((c) => c.status === "success").length;
  const errorCount = cronHealth.filter((c) => c.status === "error").length;
  const overallTone =
    errorCount > 0
      ? "danger"
      : succeededCount === cronHealth.length
        ? "success"
        : "neutral";

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2">
          <Cog className="w-4 h-4 text-[var(--color-text-secondary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("cronHealth")}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              overallTone === "success"
                ? "bg-[#22C55E]"
                : overallTone === "danger"
                  ? "bg-[#EF4444]"
                  : "bg-[#F59E0B]"
            }`}
          />
          <span className="text-[11px] text-[var(--color-text-secondary)]">
            {t("cronHealthSummary", {
              ok: succeededCount,
              total: cronHealth.length,
            })}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((c, i) => {
          const ok = c.status === "success";
          const running = c.status === "running";
          const dotCls = ok
            ? "bg-[#22C55E]"
            : running
              ? "bg-[#F59E0B]"
              : "bg-[#EF4444]";
          const colStart = i % 3;
          const isLastRow = i >= sorted.length - (sorted.length % 3 || 3);
          return (
            <div
              key={c.name}
              className={`px-4 py-3 ${
                colStart > 0 ? "border-s border-[var(--color-border-subtle)]" : ""
              } ${
                !isLastRow ? "border-b border-[var(--color-border-subtle)]" : ""
              }`}
              title={c.errorMessage || ""}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls}`} />
                  <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                    {humanizeCronName(c.name, t)}
                  </span>
                </div>
                {c.durationMs !== null && c.durationMs !== undefined && (
                  <span className="text-[10px] text-[var(--color-text-secondary)] tabular-nums flex-shrink-0">
                    {c.durationMs}ms
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-[var(--color-text-secondary)]">
                  {c.lastStartedAt
                    ? formatAgo(c.lastStartedAt, t)
                    : t("cronNeverRan")}
                </span>
                {!ok && !running && (
                  <span className="text-[10px] font-medium text-[#991B1B]">
                    {t("cronError")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Audit trail — paginated section listing every meaningful support
// action across all tickets. Replaces the old "Recent Activity" widget
// (which silently surfaced "NaNh ago" when the timestamp field name
// drifted). Manages its own page state + refresh-on-click; doesn't
// auto-poll so the operator's scroll position is stable.
function AuditTrailSection({
  t,
  onOpenTicket,
}: {
  t: ReturnType<typeof useTranslations>;
  onOpenTicket: (ticketId: string) => void;
}) {
  const [data, setData] = useState<AuditTrailResponse | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPage = useCallback(
    async (targetPage: number, refresh = false) => {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      try {
        const res = await supportApi.getSupportAuditTrail(targetPage, 20);
        setData(res);
      } catch {
        // Toast handled at parent level; keep the section visible with
        // stale data so the operator isn't jolted into a blank pane.
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchPage(page);
  }, [page, fetchPage]);

  return (
    <div className="p-5 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--color-text-secondary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("auditTrail")}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => void fetchPage(page, true)}
          disabled={isRefreshing || isLoading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
          title={t("refresh")}
        >
          <RefreshCw
            className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`}
          />
          {t("refresh")}
        </button>
      </div>

      {isLoading && !data ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-secondary)]" />
        </div>
      ) : !data || data.data.length === 0 ? (
        <EmptyState text={t("noAuditTrail")} />
      ) : (
        <>
          <div className="flex flex-col divide-y divide-[var(--color-border-subtle)]">
            {data.data.map((row) => (
              <AuditRow key={row.id} row={row} t={t} onOpen={onOpenTicket} />
            ))}
          </div>
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--color-border)]">
              <span className="text-[11px] text-[var(--color-text-secondary)]">
                {t("paginationShowing", {
                  from: (data.page - 1) * data.limit + 1,
                  to: Math.min(data.page * data.limit, data.total),
                  total: data.total,
                })}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={data.page <= 1 || isRefreshing}
                  className="p-1.5 border border-[var(--color-border)] rounded-lg disabled:opacity-40 hover:bg-[var(--color-border-subtle)]"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] text-[var(--color-text-secondary)] px-2 tabular-nums">
                  {data.page} / {data.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={data.page >= data.totalPages || isRefreshing}
                  className="p-1.5 border border-[var(--color-border)] rounded-lg disabled:opacity-40 hover:bg-[var(--color-border-subtle)]"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// One row of the audit trail. Each action maps to a coloured icon so
// scrolling the trail visually groups types (red = breach-related,
// green = resolved, etc.). The ticket reference is the click target.
function AuditRow({
  row,
  t,
  onOpen,
}: {
  row: AuditTrailResponse["data"][number];
  t: ReturnType<typeof useTranslations>;
  onOpen: (ticketId: string) => void;
}) {
  const { icon: Icon, tone } = auditIconFor(row.action);
  const performerLabel = row.performerName || t("auditUnknownActor");
  const refLabel = row.ticketReferenceNumber || row.ticketId.slice(0, 8);

  // Build a one-line description from metadata where useful. Falls back
  // to the action label alone if metadata is absent (older rows).
  const md = (row.metadata || {}) as Record<string, unknown>;
  let detail: string | null = null;
  if (row.action === "assignee_changed") {
    detail = t("auditDetailAssignee");
  } else if (row.action === "priority_changed") {
    detail = t("auditDetailPriority", {
      from: String(md.previousPriority || "?"),
      to: String(md.newPriority || "?"),
    });
  } else if (row.action === "status_changed") {
    detail = t("auditDetailStatus", {
      from: String(md.previousStatus || "?"),
      to: String(md.newStatus || "?"),
    });
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(row.ticketId)}
      className="flex items-start gap-3 py-2.5 text-start hover:bg-[var(--color-border-subtle)] -mx-2 px-2 rounded"
    >
      <span
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
          tone === "success"
            ? "bg-[#DCFCE7] text-[#15803D]"
            : tone === "danger"
              ? "bg-[#FEE2E2] text-[#991B1B]"
              : tone === "warning"
                ? "bg-[#FEF3C7] text-[#92400E]"
                : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-[var(--color-text-primary)]">
            {t(`auditAction.${row.action}`)}
          </span>
          <span className="text-[10px] text-[var(--color-primary)] font-medium">
            {refLabel}
          </span>
          {row.ticketSubject && (
            <span className="text-[11px] text-[var(--color-text-secondary)] truncate">
              · {row.ticketSubject}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-secondary)] mt-0.5">
          <span>{performerLabel}</span>
          {row.performerRole && (
            <span className="text-[9px] uppercase tracking-wide bg-[var(--color-border-subtle)] px-1 rounded">
              {t(`auditRole.${row.performerRole}`)}
            </span>
          )}
          {detail && (
            <>
              <span>·</span>
              <span>{detail}</span>
            </>
          )}
          <span>·</span>
          <span>{formatAgo(row.createdAt, t)}</span>
        </div>
      </div>
    </button>
  );
}

function auditIconFor(action: string): {
  icon: React.ComponentType<{ className?: string }>;
  tone: "neutral" | "success" | "warning" | "danger";
} {
  switch (action) {
    case "ticket_created":
      return { icon: FilePlus, tone: "neutral" };
    case "ticket_replied":
      return { icon: MessageSquare, tone: "neutral" };
    case "internal_note_added":
      return { icon: Lock, tone: "warning" };
    case "assignee_changed":
      return { icon: UserCheck, tone: "neutral" };
    case "priority_changed":
      return { icon: ArrowUp, tone: "warning" };
    case "status_changed":
      return { icon: Activity, tone: "neutral" };
    case "ticket_resolved":
      return { icon: CircleCheckBig, tone: "success" };
    case "ticket_closed":
      return { icon: XOctagon, tone: "neutral" };
    case "ticket_reopened":
      return { icon: RotateCcw, tone: "warning" };
    // SLA events (system-generated). Breaches are danger; warnings
    // and escalations are warning; resolved-within-SLA is success.
    case "sla_frt_breach":
    case "sla_ttr_breach":
    case "sla_frt_breach_reassigned":
    case "sla_ttr_breach_reassigned":
      return { icon: AlertTriangle, tone: "danger" };
    case "sla_frt_warning_75":
    case "sla_priority_escalated":
    case "sla_escalation_triggered":
      return { icon: AlertTriangle, tone: "warning" };
    case "sla_resolved_within_sla":
      return { icon: CircleCheckBig, tone: "success" };
    default:
      return { icon: Activity, tone: "neutral" };
  }
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-xs text-[var(--color-text-secondary)] py-6 text-center">
      {text}
    </p>
  );
}

/* ─── helpers ─── */

function secondsSince(d: Date): number {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
}

function formatAgo(iso: string, t: ReturnType<typeof useTranslations>): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return t("agoSeconds", { count: seconds });
  if (seconds < 3600) return t("agoMinutes", { count: Math.floor(seconds / 60) });
  return t("agoHours", { count: Math.floor(seconds / 3600) });
}

function formatRelative(
  iso: string,
  t: ReturnType<typeof useTranslations>,
): string {
  return formatAgo(iso, t);
}

export default SupportOverviewTab;
