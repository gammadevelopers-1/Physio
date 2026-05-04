"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import SessionCard from "./SessionCard";
import { Calendar } from "lucide-react";

interface Session {
  id: string;
  title: string;
  thumbnail: string;
  type: "zoom" | "onsite" | "hybrid";
  status: "scheduled" | "live" | "ended" | "completed" | "cancelled";
  location?: string;
  enrolled: number;
  time: string;
  zoomLink?: string;
}

interface TodaysSessionsProps {
  sessions: Session[];
  onStartSession?: (sessionId: string) => void;
  onEndSession?: (sessionId: string) => void;
  onAttendance?: (sessionId: string) => void;
  onShare?: (sessionId: string) => void;
}

const TodaysSessions = ({
  sessions,
  onStartSession,
  onEndSession,
  onAttendance,
  onShare,
}: TodaysSessionsProps) => {
  const t = useTranslations("instructorDashboard");
  const router = useRouter();
  const locale = useLocale();

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 border-b border-[var(--color-border)] gap-3">
        <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
          {t("todaysSessions.title")}
        </h2>
        <button
          onClick={() => router.push(`/${locale}/dashboard/instructor/sessions?view=calendar`)}
          className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
        >
          {t("todaysSessions.viewCalendar")}
        </button>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 bg-[var(--color-border-subtle)] rounded-full flex items-center justify-center mb-3">
              <Calendar className="w-6 h-6 text-[var(--color-text-secondary)]" />
            </div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              {t("todaysSessions.noSessionsTitle")}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] text-center max-w-[200px]">
              {t("todaysSessions.noSessionsDescription")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onStart={() => onStartSession?.(session.id)}
                onEnd={() => onEndSession?.(session.id)}
                onAttendance={() => onAttendance?.(session.id)}
                onShare={() => onShare?.(session.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TodaysSessions;
