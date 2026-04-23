"use client";

import { useTranslations, useLocale } from "next-intl";
import { BarChart3, ArrowRight } from "lucide-react";

const SLAPerformanceWidget = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const slaMetrics = [
    {
      id: "firstResponse",
      label: t("sla.firstResponseTime"),
      actual: "1.2h",
      target: t("sla.targetLabel", { value: "2h" }),
      fill: 60,
      color: "bg-[#22C55E]",
    },
    {
      id: "resolution",
      label: t("sla.resolutionTime"),
      actual: "4.5h",
      target: t("sla.targetLabel", { value: "6h" }),
      fill: 75,
      color: "bg-[#22C55E]",
    },
    {
      id: "breaches",
      label: t("sla.slaBreaches"),
      actual: "2",
      target: t("sla.today"),
      fill: 20,
      color: "bg-[#F97316]",
      actualColor: "text-[#F97316]",
    },
    {
      id: "backlog",
      label: t("sla.backlogAge"),
      actual: "12h",
      target: t("sla.oldestTicket"),
      fill: 40,
      color: "bg-[#F97316]",
      actualColor: "text-[#F97316]",
    },
  ];

  const agents = [
    {
      id: "hana",
      nameKey: "hanaAlSaud",
      initials: "HA",
      status: "online" as const,
      openTickets: 8,
      avgResponse: "1.0h",
      csat: 96,
    },
    {
      id: "mohammed",
      nameKey: "mohammedAli",
      initials: "MA",
      status: "online" as const,
      openTickets: 6,
      avgResponse: "1.5h",
      csat: 92,
    },
    {
      id: "layla",
      nameKey: "laylaAhmed",
      initials: "LA",
      status: "away" as const,
      openTickets: 5,
      avgResponse: "1.3h",
      csat: 94,
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#8B5CF6]" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
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
                  <p className="text-[13px] font-medium text-[var(--color-text-primary)]">
                    {t(`sla.agents.${agent.nameKey}`)}
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
                      {agent.csat}%
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
