"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  TrendingUp,
  UserCheck,
  Calendar,
  Video,
  MapPin,
  Globe,
} from "lucide-react";
import type { StudentDashboardStats } from "@/types/student-dashboard";

interface DashboardStatsProps {
  stats: StudentDashboardStats | null;
}

// ─── Countdown Hook ──────────────────────────────────────
function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    if (!targetDate) return;
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
      });
    };
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

// All three KPI cards share the same shape — icon, label, big value,
// one sub-line — so they read as a balanced trio. Card-specific extras
// (progress bar, join button, etc.) were intentionally removed; richer
// affordances live in the dedicated widgets below.
interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  subtitle: React.ReactNode;
}

const KpiCard = ({ icon, label, value, valueClassName, subtitle }: KpiCardProps) => (
  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-3 min-h-[140px]">
    <div className="w-10 h-10 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
      {icon}
    </div>
    <div className="flex flex-col gap-0.5">
      <p className="text-sm text-[var(--color-text-secondary)]">{label}</p>
      <p
        className={`text-2xl font-bold ${valueClassName ?? "text-[var(--color-text-primary)]"}`}
      >
        {value}
      </p>
      <p className="text-xs text-[var(--color-text-secondary)] truncate flex items-center gap-1">
        {subtitle}
      </p>
    </div>
  </div>
);

// ─── Main Component ──────────────────────────────────────
const DashboardStats = ({ stats }: DashboardStatsProps) => {
  const t = useTranslations("studentDashboard");
  const timeLeft = useCountdown(stats?.nextSession?.scheduledAt ?? null);

  if (!stats) return null;

  const attendanceColor =
    stats.totalSessions === 0
      ? undefined
      : stats.attendanceRate >= 70
        ? "text-[#16A34A]"
        : "text-[#DC2626]";

  const nextSession = stats.nextSession;

  const countdownStr = nextSession
    ? [
        timeLeft.days > 0 ? `${timeLeft.days}${t("kpi.days").trim()}` : null,
        timeLeft.hours > 0 ? `${timeLeft.hours}${t("kpi.hours").trim()}` : null,
        `${timeLeft.minutes}${t("kpi.minutes").trim()}`,
      ]
        .filter(Boolean)
        .join(" ")
    : null;

  const nextSessionTypeIcon =
    nextSession?.sessionType === "onsite" ? (
      <MapPin className="w-3 h-3" />
    ) : nextSession?.sessionType === "zoom" ? (
      <Video className="w-3 h-3" />
    ) : nextSession ? (
      <Globe className="w-3 h-3" />
    ) : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <KpiCard
        icon={<TrendingUp className="w-6 h-6 text-[#D4A520]" />}
        label={t("kpi.overallProgress")}
        value={`${Math.round(stats.averageProgress)}%`}
        subtitle={t("kpi.coursesBreakdown", {
          active: stats.inProgressCourses,
          completed: stats.completedCourses,
        })}
      />

      <KpiCard
        icon={<UserCheck className="w-6 h-6 text-[#D4A520]" />}
        label={t("kpi.attendanceRate")}
        value={`${stats.attendanceRate}%`}
        valueClassName={attendanceColor}
        subtitle={t("kpi.sessionsCount", {
          attended: stats.sessionsAttended,
          total: stats.totalSessions,
        })}
      />

      <KpiCard
        icon={<Calendar className="w-6 h-6 text-[#D4A520]" />}
        label={t("kpi.nextSession")}
        value={nextSession ? countdownStr : "—"}
        valueClassName={nextSession ? undefined : "text-[var(--color-text-secondary)]"}
        subtitle={
          nextSession ? (
            <>
              {nextSessionTypeIcon}
              <span className="truncate">{nextSession.title}</span>
            </>
          ) : (
            t("kpi.noUpcomingSessions")
          )
        }
      />
    </div>
  );
};

export default DashboardStats;
