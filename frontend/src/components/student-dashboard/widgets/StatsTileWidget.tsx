"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Coins, Award } from "lucide-react";
import type { StudentDashboardStats } from "@/types/student-dashboard";
import type { StudentProfile } from "@/hooks/useStudentProfile";

interface StatsTileWidgetProps {
  user: StudentProfile;
  stats: StudentDashboardStats | null;
}

export default function StatsTileWidget({ user, stats }: StatsTileWidgetProps) {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.statsTile");
  const isRTL = locale === "ar";

  // Badges tile hidden — backend not implemented yet (page kept for future use).
  const tiles = [
    {
      key: "points",
      icon: Coins,
      iconColor: "text-[#D4A520]",
      iconBg: "bg-[#FEF3C7]",
      label: t("points"),
      value: user.points ?? 0,
      href: `/${locale}/dashboard/student/invite-friends`,
    },
    {
      key: "certificates",
      icon: Award,
      iconColor: "text-[#16A34A]",
      iconBg: "bg-[#DCFCE7]",
      label: t("certificates"),
      value: stats?.certificatesEarned ?? 0,
      href: `/${locale}/dashboard/student/certifications`,
    },
  ];

  return (
    <div
      className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">
        {t("title")}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.key}
              href={tile.href}
              className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] transition-colors text-center"
            >
              <div className={`w-9 h-9 rounded-lg ${tile.iconBg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${tile.iconColor}`} />
              </div>
              <span className="text-base font-bold text-[var(--color-text-primary)] leading-none">
                {tile.value}
              </span>
              <span className="text-[10px] text-[var(--color-text-secondary)] leading-tight">
                {tile.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
