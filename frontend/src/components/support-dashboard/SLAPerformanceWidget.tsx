"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { BarChart3, ArrowRight, Loader2 } from "lucide-react";
import { supportApi } from "@/lib/api";

const SLAPerformanceWidget = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [kpiData, setKpiData] = useState<{
    openTickets: number;
    highPriorityOpen: number;
    slaBreaches: number;
    avgFrtMinutes: number | null;
    avgTtrMinutes: number | null;
    statusBreakdown: Record<string, number>;
  } | null>(null);
  const [agentData, setAgentData] = useState<
    {
      userId: string;
      supportSubRole: string | null;
      firstName: string | null;
      lastName: string | null;
      email: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [kpis, agentsRes] = await Promise.all([
          supportApi.getKPIs(),
          supportApi.getAgents(),
        ]);
        setKpiData(kpis.data);
        setAgentData(agentsRes.data ?? []);
      } catch (err) {
        console.error("Failed to load SLA data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatMinutes = (minutes: number | null): string => {
    if (minutes === null || minutes === undefined) return "--";
    if (minutes < 60) return `${Math.round(minutes)}m`;
    return `${(minutes / 60).toFixed(1)}h`;
  };

  const FRT_TARGET_MINUTES = 120; // 2h
  const TTR_TARGET_MINUTES = 360; // 6h

  const slaMetrics = kpiData
    ? [
        {
          id: "firstResponse",
          label: t("sla.firstResponseTime"),
          actual: formatMinutes(kpiData.avgFrtMinutes),
          target: t("sla.targetLabel", { value: "2h" }),
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
          target: t("sla.targetLabel", { value: "6h" }),
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

  const agents = agentData.map((agent) => {
    const first = agent.firstName ?? "";
    const last = agent.lastName ?? "";
    const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || agent.email.charAt(0).toUpperCase();
    const displayName = first && last ? `${first} ${last}` : agent.email;
    return {
      id: agent.userId,
      displayName,
      initials,
      status: "online" as const,
      openTickets: "--" as const,
      avgResponse: "--",
      csat: "--" as const,
    };
  });

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#8B5CF6]" />
            <h3 className="text-base font-semibold text-[#111827]">
              {t("sla.title")}
            </h3>
          </div>
        </div>
        <div className="flex items-center justify-center p-10">
          <Loader2 className="w-6 h-6 text-[#8B5CF6] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#8B5CF6]" />
          <h3 className="text-base font-semibold text-[#111827]">
            {t("sla.title")}
          </h3>
        </div>
        <button className="text-sm font-medium text-[#3B82F6] hover:text-[#2563EB] hover:underline flex items-center gap-1">
          {t("sla.viewDetails")}
          <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div className="p-5">
        {/* SLA Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {slaMetrics.map((metric) => (
            <div key={metric.id} className="bg-[#F9FAFB] rounded-lg p-3">
              <p className="text-[11px] text-[#6B7280] mb-1">{metric.label}</p>
              <div className="flex items-baseline justify-between mb-2">
                <span
                  className={`text-lg font-bold ${metric.actualColor || "text-[#111827]"}`}
                >
                  {metric.actual}
                </span>
                <span className="text-[11px] text-[#9CA3AF]">
                  {metric.target}
                </span>
              </div>
              <div className="h-1 bg-[#E5E7EB] rounded-full">
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
          <h4 className="text-sm font-semibold text-[#374151] mb-3">
            {t("sla.agentPerformance")}
          </h4>
          <div className="space-y-2.5">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center gap-3 p-2.5 bg-[#F9FAFB] rounded-lg border border-[#F3F4F6]"
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
                  <p className="text-[13px] font-medium text-[#111827]">
                    {agent.displayName}
                  </p>
                  <p className="text-[11px] text-[#6B7280]">
                    {t(`sla.agentStatus.${agent.status}`)}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-[#111827]">
                      {agent.openTickets}
                    </p>
                    <p className="text-[10px] text-[#9CA3AF]">
                      {t("sla.open")}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-[#111827]">
                      {agent.avgResponse}
                    </p>
                    <p className="text-[10px] text-[#9CA3AF]">
                      {t("sla.avg")}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold text-[#16A34A]">
                      {agent.csat === "--" ? "--" : `${agent.csat}%`}
                    </p>
                    <p className="text-[10px] text-[#9CA3AF]">
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
