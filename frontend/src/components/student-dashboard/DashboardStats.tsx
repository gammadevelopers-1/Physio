"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Video, MapPin, Globe, Loader2 } from "lucide-react";
import type { StudentDashboardStats } from "@/types/student-dashboard";
import { studentApi } from "@/lib/api";

interface DashboardStatsProps {
  stats: StudentDashboardStats | null;
}

// ─── Circular Progress Ring ──────────────────────────────
function ProgressRing({
  percentage,
  size = 80,
  strokeWidth = 8,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#16A34A"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

// ─── Countdown Hook ──────────────────────────────────────
function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });
  const [isJoinable, setIsJoinable] = useState(false);

  useEffect(() => {
    if (!targetDate) return;
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0 });
        setIsJoinable(true);
        return;
      }
      setIsJoinable(diff <= 15 * 60 * 1000);
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

  return { timeLeft, isJoinable };
}

// ─── Main Component ──────────────────────────────────────
const DashboardStats = ({ stats }: DashboardStatsProps) => {
  const t = useTranslations("studentDashboard");
  const [joiningZoom, setJoiningZoom] = useState(false);
  const { timeLeft, isJoinable } = useCountdown(
    stats?.nextSession?.scheduledAt ?? null,
  );

  const handleJoinZoom = async (sessionId: string) => {
    setJoiningZoom(true);
    try {
      const { joinUrl } = await studentApi.getSessionJoinUrl(sessionId);
      window.open(joinUrl, "_blank");
    } catch {
      // Fallback to raw link
      if (stats?.nextSession?.zoomLink) window.open(stats.nextSession.zoomLink, "_blank");
    } finally {
      setJoiningZoom(false);
    }
  };

  if (!stats) return null;

  const attendanceColor =
    stats.attendanceRate >= 70 ? "bg-[#16A34A]" : "bg-[#DC2626]";
  const attendanceTextColor =
    stats.attendanceRate >= 70 ? "text-[#16A34A]" : "text-[#DC2626]";

  const nextSession = stats.nextSession;
  const isZoom =
    nextSession?.sessionType === "zoom" ||
    nextSession?.sessionType === "blended";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Overall Progress */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <ProgressRing percentage={stats.averageProgress} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-[var(--color-text-primary)]">
              {Math.round(stats.averageProgress)}%
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            {t("kpi.overallProgress")}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            {t("kpi.activeCourses", { count: stats.inProgressCourses })}
          </p>
        </div>
      </div>

      {/* Card 2: Attendance Rate */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 flex flex-col justify-between">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          {t("kpi.attendanceRate")}
        </p>
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-2xl font-bold ${attendanceTextColor}`}>
              {stats.attendanceRate}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-[var(--color-border)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${attendanceColor}`}
              style={{ width: `${Math.min(stats.attendanceRate, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1.5">
            {t("kpi.sessionsCount", {
              attended: stats.sessionsAttended,
              total: stats.totalSessions,
            })}
          </p>
        </div>
      </div>

      {/* Card 3: Certificates */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 flex flex-col justify-between">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          {t("kpi.certificates")}
        </p>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-[#16A34A]">
              {stats.certificatesEarned}
            </span>
            <span className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
              {t("kpi.earned")}
            </span>
          </div>
          <div className="w-px h-8 bg-[var(--color-border)]" />
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold text-[#F59E0B]">
              {stats.certificatesPending}
            </span>
            <span className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
              {t("kpi.pending")}
            </span>
          </div>
          {stats.certificatesExpiringSoon > 0 && (
            <>
              <div className="w-px h-8 bg-[var(--color-border)]" />
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-[#DC2626]">
                  {stats.certificatesExpiringSoon}
                </span>
                <span className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                  {t("kpi.expiring")}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Card 4: Next Session */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 flex flex-col justify-between">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          {t("kpi.nextSession")}
        </p>
        {nextSession ? (
          <div className="mt-2">
            <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
              {nextSession.title}
            </p>
            <p className="text-[10px] text-[var(--color-text-secondary)] truncate mt-0.5">
              {nextSession.courseTitle}
            </p>
            <div className="flex items-center gap-1 mt-2">
              {nextSession.sessionType === "zoom" && (
                <Video className="w-3 h-3 text-blue-500" />
              )}
              {nextSession.sessionType === "onsite" && (
                <MapPin className="w-3 h-3 text-green-600" />
              )}
              {(nextSession.sessionType === "blended" ||
                nextSession.sessionType === "hybrid") && (
                <Globe className="w-3 h-3 text-purple-500" />
              )}
              <div className="flex items-center gap-1 text-sm font-semibold text-[var(--color-text-primary)]">
                {timeLeft.days > 0 && (
                  <span>
                    {timeLeft.days}
                    {t("kpi.days")}
                  </span>
                )}
                <span>
                  {timeLeft.hours}
                  {t("kpi.hours")}
                </span>
                <span>
                  {timeLeft.minutes}
                  {t("kpi.minutes")}
                </span>
              </div>
            </div>
            {isZoom && nextSession.zoomLink && (
              <button
                onClick={() => isJoinable && handleJoinZoom(nextSession.id)}
                disabled={!isJoinable || joiningZoom}
                className={`mt-2 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isJoinable
                    ? "bg-[#2D8CFF] text-white hover:bg-[#1A73E8]"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                {joiningZoom ? <Loader2 className="w-3 h-3 animate-spin" /> : <Video className="w-3 h-3" />}
                {isJoinable ? t("kpi.joinNow") : t("kpi.join")}
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-secondary)] mt-3">
            {t("kpi.noUpcomingSessions")}
          </p>
        )}
      </div>
    </div>
  );
};

export default DashboardStats;
