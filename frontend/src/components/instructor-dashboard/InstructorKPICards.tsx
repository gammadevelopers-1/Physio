"use client";

import { useTranslations } from "next-intl";
import { BookOpen, Calendar, AlertTriangle } from "lucide-react";

interface KPIData {
  activeCourses: number;
  todaysSessions: number;
  atRiskLearners: number;
}

interface InstructorKPICardsProps {
  data: KPIData;
}

const InstructorKPICards = ({ data }: InstructorKPICardsProps) => {
  const t = useTranslations("instructorDashboard");

  const kpiCards = [
    {
      id: "activeCourses",
      label: t("kpi.activeCourses"),
      value: data.activeCourses,
      icon: BookOpen,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D4A520]",
    },
    {
      id: "todaysSessions",
      label: t("kpi.todaysSessions"),
      value: data.todaysSessions,
      icon: Calendar,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D4A520]",
    },
    {
      id: "atRiskLearners",
      label: t("kpi.atRiskLearners"),
      value: data.atRiskLearners,
      icon: AlertTriangle,
      iconBg: "bg-[#FEE2E2]",
      iconColor: "text-[#EF4444]",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {kpiCards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex flex-col gap-3"
          >
            <div
              className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center`}
            >
              <Icon className={`w-6 h-6 ${card.iconColor}`} />
            </div>
            <div>
              <p className="text-sm text-[#6B7280]">{card.label}</p>
              <p className="text-2xl font-bold text-[#1F2937]">{card.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default InstructorKPICards;
