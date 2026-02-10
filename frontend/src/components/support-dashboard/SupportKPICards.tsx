"use client";

import { useTranslations } from "next-intl";
import {
  ClipboardList,
  Clock,
  RotateCcw,
  Smile,
  ShieldCheck,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface KPIData {
  openTickets: number;
  highPriority: number;
  medPriority: number;
  lowPriority: number;
  avgResponseTime: string;
  avgResponseTrend: string;
  avgResolution: string;
  resolutionTarget: string;
  csatScore: number;
  csatTrend: string;
  slaCompliance: number;
  slaBreaches: number;
  escalatedTickets: number;
  escalatedTrend: string;
}

interface SupportKPICardsProps {
  data: KPIData;
}

const SupportKPICards = ({ data }: SupportKPICardsProps) => {
  const t = useTranslations("supportDashboard");

  const kpiCards = [
    {
      id: "openTickets",
      label: t("kpi.openTickets"),
      value: data.openTickets.toString(),
      meta: t("kpi.highMedLow", {
        high: data.highPriority,
        med: data.medPriority,
        low: data.lowPriority,
      }),
      icon: ClipboardList,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
      metaColor: "text-[#6B7280]",
    },
    {
      id: "avgResponseTime",
      label: t("kpi.avgResponseTime"),
      value: data.avgResponseTime,
      meta: data.avgResponseTrend + " " + t("kpi.vsLastWeek"),
      icon: Clock,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
      metaColor: "text-[#16A34A]",
      trendIcon: "down",
    },
    {
      id: "avgResolution",
      label: t("kpi.avgResolution"),
      value: data.avgResolution,
      meta: t("kpi.target", { value: data.resolutionTarget }),
      icon: RotateCcw,
      iconBg: "bg-[#FFEDD5]",
      iconColor: "text-[#EA580C]",
      metaColor: "text-[#6B7280]",
    },
    {
      id: "csatScore",
      label: t("kpi.csatScore"),
      value: data.csatScore + "%",
      meta: data.csatTrend,
      icon: Smile,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D97706]",
      metaColor: "text-[#16A34A]",
      trendIcon: "up",
    },
    {
      id: "slaCompliance",
      label: t("kpi.slaCompliance"),
      value: data.slaCompliance + "%",
      meta: t("kpi.breachesToday", { count: data.slaBreaches }),
      icon: ShieldCheck,
      iconBg: "bg-[#EDE9FE]",
      iconColor: "text-[#8B5CF6]",
      metaColor: "text-[#6B7280]",
    },
    {
      id: "escalatedTickets",
      label: t("kpi.escalatedTickets"),
      value: data.escalatedTickets.toString(),
      meta: data.escalatedTrend + " " + t("kpi.vsLastWeek"),
      icon: ArrowUpRight,
      iconBg: "bg-[#FEE2E2]",
      iconColor: "text-[#DC2626]",
      metaColor: "text-[#DC2626]",
      trendIcon: "up",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {kpiCards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-start gap-3"
          >
            <div
              className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
            >
              <Icon className={`w-5 h-5 ${card.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#6B7280] mb-0.5">{card.label}</p>
              <p className="text-xl font-bold text-[#111827]">{card.value}</p>
              <div className="flex items-center gap-1 mt-1">
                {card.trendIcon === "down" && (
                  <TrendingDown className="w-3 h-3 text-[#16A34A]" />
                )}
                {card.trendIcon === "up" && (
                  <TrendingUp className="w-3 h-3 text-[#16A34A]" />
                )}
                <span className={`text-[11px] ${card.metaColor}`}>
                  {card.meta}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SupportKPICards;
