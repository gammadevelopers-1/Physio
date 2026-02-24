"use client";

import { useTranslations } from "next-intl";
import { BookOpen, Users, FileText, TrendingUp, UserCheck, ShieldCheck, DollarSign } from "lucide-react";

interface KPIData {
  totalCourses: number;
  totalEnrollments: number;
  pendingReviews: number;
  avgCompletionRate?: number;
  activeInstructors?: number;
  nelcScore?: number;
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
      suffix: "",
      icon: BookOpen,
      iconBg: "bg-[var(--gold-gold-100)]",
      iconColor: "text-[var(--gold-gold-500)]",
    },
    {
      id: "totalEnrollments",
      label: t("kpi.totalEnrollments"),
      value: data.totalEnrollments,
      suffix: "",
      icon: Users,
      iconBg: "bg-[var(--gold-gold-100)]",
      iconColor: "text-[var(--gold-gold-500)]",
    },
    {
      id: "pendingReviews",
      label: t("kpi.pendingReviews"),
      value: data.pendingReviews,
      suffix: "",
      icon: FileText,
      iconBg: "bg-[var(--functional-red-400)]/10",
      iconColor: "text-[var(--functional-red-600)]",
    },
    {
      id: "avgCompletion",
      label: t("kpi.avgCompletion"),
      value: data.avgCompletionRate ?? 0,
      suffix: "%",
      icon: TrendingUp,
      iconBg: "bg-[#D1FAE5]",
      iconColor: "text-[#065F46]",
    },
    {
      id: "activeInstructors",
      label: "Active Instructors",
      value: data.activeInstructors ?? 0,
      suffix: "",
      icon: UserCheck,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
    },
    {
      id: "nelcScore",
      label: "NELC Compliance",
      value: data.nelcScore ?? 0,
      suffix: "%",
      icon: ShieldCheck,
      iconBg: "bg-[#F3E8FF]",
      iconColor: "text-[#9333EA]",
    },
    {
      id: "totalRevenue",
      label: t("kpi.totalRevenue"),
      value: data.totalRevenue ?? 0,
      suffix: " SAR",
      icon: DollarSign,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D97706]",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-6">
      {kpiCards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="bg-[var(--surface-intense)] rounded-xl border border-[#E5E7EB] p-4 flex flex-col gap-3"
          >
            <div
              className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center`}
            >
              <Icon className={`w-6 h-6 ${card.iconColor}`} />
            </div>
            <div>
              <p className="text-sm text-[var(--on-surface-variant)]">{card.label}</p>
              <p className="text-2xl font-bold text-[var(--on-surface-default)]">
                {card.value}{card.suffix}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CourseManagerKPICards;
