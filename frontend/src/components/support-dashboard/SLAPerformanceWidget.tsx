"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { BarChart3, ArrowRight, Loader2 } from "lucide-react";
import { supportApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface AgentPerfRow {
  userId: string;
  name: string;
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  avgFrtMinutes: number | null;
  csatAvgScore: number | null;
  csatResponses: number;
  frtBreaches: number;
  ttrBreaches: number;
}

const SLAPerformanceWidget = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  const { user } = useAuth();
  const isSupervisor = user?.supportSubRole === "supervisor";
  const basePath = isSupervisor
    ? `/${locale}/dashboard/support/supervisor`
    : `/${locale}/dashboard/support/agent`;

  const [kpiData, setKpiData] = useState<Awaited<
    ReturnType<typeof supportApi.getKPIs>
  > | null>(null);
  const [slaTargets, setSlaTargets] = useState<{
    frtMinutes: number;
    ttrMinutes: number;
  } | null>(null);
  const [agentPerf, setAgentPerf] = useState<AgentPerfRow[]>([]);
  const [agentDirectory, setAgentDirectory] = useState<
    {
      userId: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const [kpis, agentsRes, perfRes, policiesRes] = await Promise.all([
          supportApi.getKPIs(),
          supportApi.getAgents(),
          supportApi.getAgentPerformance(),
          supportApi.getSlaPolicies().catch(() => []),
        ]);
        if (cancelled) return;
        setKpiData(kpis);
        setAgentDirectory(Array.isArray(agentsRes) ? agentsRes : []);
        setAgentPerf(Array.isArray(perfRes) ? (perfRes as AgentPerfRow[]) : []);
        // Use the medium-priority policy as the baseline target — it's
        // the default for most tickets. If absent, fall back to the
        // first available policy.
        const policies = Array.isArray(policiesRes) ? policiesRes : [];
        const medium = policies.find((p: any) => p.priority === "medium");
        const baseline = medium || policies[0];
        if (baseline) {
          setSlaTargets({
            frtMinutes: baseline.frtMinutes,
            ttrMinutes: baseline.ttrMinutes,
          });
        }
      } catch (err) {
        console.error("Failed to load SLA data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    // Auto-refresh every 60s while the tab is visible
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchData();
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const formatMinutes = (minutes: number | null): string => {
    if (minutes === null || minutes === undefined) return "--";
    if (minutes < 60) return `${Math.round(minutes)}m`;
    return `${(minutes / 60).toFixed(1)}h`;
  };

  // Pull targets from the admin-configured SLA policies (baseline = medium
  // priority). Fall back to 2h / 6h only if the API hasn't returned yet.
  const FRT_TARGET_MINUTES = slaTargets?.frtMinutes ?? 120;
  const TTR_TARGET_MINUTES = slaTargets?.ttrMinutes ?? 360;

  const slaMetrics = kpiData
    ? [
        {
          id: "firstResponse",
          label: t("sla.firstResponseTime"),
          actual: formatMinutes(kpiData.avgFrtMinutes),
          target: t("sla.targetLabel", {
            value: formatMinutes(FRT_TARGET_MINUTES),
          }),
          fill: kpiData.avgFrtMinutes !== null
            ? Math.min(100, Math.round((kpiData.avgFrtMinutes / FRT_TARGET_MINUTES) * 100))
            : 0,
          color: kpiData.avgFrtMinutes !== null && kpiData.avgFrtMinutes <= FRT_TARGET_MINUTES
            ? "bg-[#22C55E]"
            : "bg-[#F97316]",
        },
        {
          id: "resolution",
          label: t("sla.resolutionTime"),
          actual: formatMinutes(kpiData.avgTtrMinutes),
          target: t("sla.targetLabel", {
            value: formatMinutes(TTR_TARGET_MINUTES),
          }),
          fill: kpiData.avgTtrMinutes !== null
            ? Math.min(100, Math.round((kpiData.avgTtrMinutes / TTR_TARGET_MINUTES) * 100))
            : 0,
          color: kpiData.avgTtrMinutes !== null && kpiData.avgTtrMinutes <= TTR_TARGET_MINUTES
            ? "bg-[#22C55E]"
            : "bg-[#F97316]",
        },
        {
          id: "breaches",
          label: t("sla.slaBreaches"),
          actual: String(kpiData.slaBreaches),
          target: t("sla.today"),
          fill: Math.min(100, kpiData.slaBreaches * 10),
          color: kpiData.slaBreaches > 0 ? "bg-[#F97316]" : "bg-[#22C55E]",
          actualColor: kpiData.slaBreaches > 0 ? "text-[#F97316]" : undefined,
        },
        {
          id: "backlog",
          label: t("sla.backlogAge"),
          actual: String(kpiData.openTickets),
          target: t("sla.oldestTicket"),
          fill: Math.min(100, kpiData.openTickets * 5),
          color: kpiData.openTickets > 10 ? "bg-[#F97316]" : "bg-[#22C55E]",
          actualColor: kpiData.openTickets > 10 ? "text-[#F97316]" : undefined,
        },
      ]
    : [];

  // Build a perf lookup keyed by userId so we can merge against the
  // agent directory (which has first/last name for avatar initials).
  const perfByUser = new Map(agentPerf.map((p) => [p.userId, p]));
  const agents = agentDirectory.map((agent) => {
    const first = agent.firstName ?? "";
    const last = agent.lastName ?? "";
    const initials =
      `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() ||
      agent.email.charAt(0).toUpperCase();
    const displayName = first && last ? `${first} ${last}` : agent.email;
    const perf = perfByUser.get(agent.userId);
    return {
      id: agent.userId,
      displayName,
      initials,
      status: "online" as const,
      openTickets: perf ? String(perf.openTickets) : "0",
      avgResponse: formatMinutes(perf?.avgFrtMinutes ?? null),
      csat:
        perf && perf.csatAvgScore != null
          ? perf.csatAvgScore.toFixed(1)
          : "—",
    };
  });

  if (loading) {
    return (
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#8B5CF6]" />
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t("sla.title")}
            </h3>
          </div>
        </div>
        {/* Skeleton mirroring the populated body: 4 SLA metric cards
            + agent performance table. No reflow when data lands. */}
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="p-3 bg-[var(--color-surface-page)] rounded-xl space-y-1.5"
              >
                <div className="h-3 w-16 bg-[var(--color-border)] rounded animate-pulse" />
                <div className="h-6 w-12 bg-[var(--color-border)] rounded animate-pulse" />
                <div className="h-2.5 w-20 bg-[var(--color-border)] rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="h-4 w-40 bg-[var(--color-border)] rounded animate-pulse mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2 border-b border-[var(--color-border)]"
              >
                <div className="w-8 h-8 bg-[var(--color-border)] rounded-full animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 bg-[var(--color-border)] rounded animate-pulse" />
                  <div className="h-2.5 w-48 bg-[var(--color-border)] rounded animate-pulse" />
                </div>
                <div className="h-3 w-12 bg-[var(--color-border)] rounded animate-pulse" />
                <div className="h-3 w-12 bg-[var(--color-border)] rounded animate-pulse" />
                <div className="h-3 w-12 bg-[var(--color-border)] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#8B5CF6]" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("sla.title")}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => router.push(`${basePath}/reports`)}
          className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] hover:underline flex items-center gap-1"
        >
          {t("sla.viewDetails")}
          <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div className="p-5">
        {/* SLA Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {slaMetrics.map((metric) => (
            <div key={metric.id} className="bg-[var(--color-surface-page)] rounded-lg p-3">
              <p className="text-[11px] text-[var(--color-text-secondary)] mb-1">{metric.label}</p>
              <div className="flex items-baseline justify-between mb-2">
                <span
                  className={`text-lg font-bold ${metric.actualColor || "text-[var(--color-text-primary)]"}`}
                >
                  {metric.actual}
                </span>
                <span className="text-[11px] text-[var(--color-text-secondary)]">
                  {metric.target}
                </span>
              </div>
              <div className="h-1 bg-[var(--color-border)] rounded-full">
                <div
                  className={`h-1 ${metric.color} rounded-full transition-all`}
                  style={{ width: `${metric.fill}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Agent Performance */}
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
            {t("sla.agentPerformance")}
          </h4>
          <div className="space-y-2.5">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-3 p-2.5 bg-[var(--color-surface-page)] rounded-lg border border-[var(--color-border-subtle)]"
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center">
                    <span className="text-[11px] font-semibold text-white">
                      {agent.initials}
                    </span>
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      agent.status === "online"
                        ? "bg-[#22C55E]"
                        : "bg-[#EAB308]"
                    }`}
                  />
                </div>

                {/* Agent Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                    {agent.displayName}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-secondary)]">
                    {t(`sla.agentStatus.${agent.status}`)}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                      {agent.openTickets}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">
                      {t("sla.open")}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                      {agent.avgResponse}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">
                      {t("sla.avg")}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-[#16A34A]">
                      {agent.csat === "—" ? "—" : `${agent.csat}/5`}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">
                      {t("sla.csat")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SLAPerformanceWidget;
