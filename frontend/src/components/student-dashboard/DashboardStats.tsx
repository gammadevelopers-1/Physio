"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

interface StatsData {
  courses: number;
  certificates: number;
  coursesCompleted: number;
}

interface DashboardStatsProps {
  stats: StatsData;
}

const DashboardStats = ({ stats }: DashboardStatsProps) => {
  const t = useTranslations("studentDashboard");

  const statCards = [
    {
      label: t("stats.courses"),
      value: stats.courses,
      icon: "/student_dashboard/learning (1) 1.svg",
    },
    {
      label: t("stats.myCertificates"),
      value: stats.certificates,
      icon: "/student_dashboard/certficate 1.svg",
    },
    {
      label: t("stats.courseCompleted"),
      value: stats.coursesCompleted,
      icon: "/student_dashboard/premium-badge 1 (2).svg",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {statCards.map((stat, index) => {
        return (
          <div
            key={index}
            className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex flex-col gap-3"
          >
            <div className="w-10 h-10 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
              <Image
                src={stat.icon}
                alt={stat.label}
                width={24}
                height={24}
                className="w-6 h-6"
              />
            </div>
            <div>
              <p className="text-sm text-[#6B7280]">{stat.label}</p>
              <p className="text-2xl font-bold text-[#1F2937]">{stat.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DashboardStats;
