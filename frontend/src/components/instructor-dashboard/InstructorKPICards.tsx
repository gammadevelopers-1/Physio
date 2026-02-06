"use client";

import { useTranslations } from "next-intl";
import {
  BookOpen,
  Calendar,
  AlertTriangle,
  Award,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface KPIData {
  myCourses: number;
  coursesChange: string;
  todaysSessions: number;
  nextSessionTime: string;
  atRiskLearners: number;
  atRiskChange: string;
  pendingCertificates: number;
  certificatesStatus: string;
}

interface InstructorKPICardsProps {
  data: KPIData;
}

const InstructorKPICards = ({ data }: InstructorKPICardsProps) => {
  const t = useTranslations("instructorDashboard");

  const kpiCards = [
    {
      label: t("kpi.myCourses"),
      value: data.myCourses,
      icon: BookOpen,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D4A520]",
      trend: data.coursesChange,
      trendUp: true,
    },
    {
      label: t("kpi.todaysSessions"),
      value: data.todaysSessions,
      icon: Calendar,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D4A520]",
      trend: `${t("kpi.next")}: ${data.nextSessionTime}`,
      trendUp: null,
    },
    {
      label: t("kpi.atRiskLearners"),
      value: data.atRiskLearners,
      icon: AlertTriangle,
      iconBg: "bg-[#FEE2E2]",
      iconColor: "text-[#EF4444]",
      trend: data.atRiskChange,
      trendUp: false,
    },
    {
      label: t("kpi.pendingCertificates"),
      value: data.pendingCertificates,
      icon: Award,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D4A520]",
      trend: data.certificatesStatus,
      trendUp: null,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {kpiCards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            <div
              className={`w-12 h-12 ${card.iconBg} rounded-xl flex items-center justify-center mb-3`}
            >
              <Icon className={`w-6 h-6 ${card.iconColor}`} />
            </div>
            <p className="text-sm text-[#6B7280] mb-1">{card.label}</p>
            <p className="text-3xl font-bold text-[#1F2937] mb-1">
              {card.value}
            </p>
            <div
              className={`flex items-center gap-1 text-sm ${
                card.trendUp === true
                  ? "text-[#22C55E]"
                  : card.trendUp === false
                    ? "text-[#EF4444]"
                    : "text-[#6B7280]"
              }`}
            >
              {card.trendUp === true && <TrendingUp className="w-4 h-4" />}
              {card.trendUp === false && <TrendingDown className="w-4 h-4" />}
              <span>{card.trend}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default InstructorKPICards;
