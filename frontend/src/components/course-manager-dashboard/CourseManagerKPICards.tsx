"use client";

import { useTranslations } from "next-intl";
import { BookOpen, Users, FileText } from "lucide-react";

interface KPIData {
  totalCourses: number;
  totalEnrollments: number;
  pendingReviews: number;
  avgCompletionRate?: number;
  activeInstructors?: number;
  totalRevenue?: number;
}

interface CourseManagerKPICardsProps {
  data: KPIData;
}

const CourseManagerKPICards = ({ data }: CourseManagerKPICardsProps) => {
  const t = useTranslations("courseManagerDashboard");

  const kpiCards = [
    {
      id: "totalCourses",
      label: t("kpi.totalCourses"),
      value: data.totalCourses,
      icon: BookOpen,
      iconBg: "bg-[var(--gold-gold-100)]",
      iconColor: "text-[var(--color-star)]",
    },
    {
      id: "totalEnrollments",
      label: t("kpi.totalEnrollments"),
      value: data.totalEnrollments,
      icon: Users,
      iconBg: "bg-[var(--gold-gold-100)]",
      iconColor: "text-[var(--color-star)]",
    },
    {
      id: "pendingReviews",
      label: t("kpi.pendingReviews"),
      value: data.pendingReviews,
      icon: FileText,
      iconBg: "bg-[var(--functional-red-400)]/10",
      iconColor: "text-[var(--functional-red-600)]",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {kpiCards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="bg-[var(--surface-intense)] rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-3"
          >
            <div
              className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center`}
            >
              <Icon className={`w-6 h-6 ${card.iconColor}`} />
            </div>
            <div>
              <p className="text-sm text-[var(--on-surface-variant)]">{card.label}</p>
              <p className="text-2xl font-bold text-[var(--on-surface-default)]">
                {card.value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CourseManagerKPICards;
