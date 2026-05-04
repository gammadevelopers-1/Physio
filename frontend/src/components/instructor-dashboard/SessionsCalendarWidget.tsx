"use client";

import { useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { getHijriParts, hijriMonthNames, hijriMonthNamesEn, gregorianMonthNames, gregorianMonthNamesAr } from "@/lib/hijri";
import {
  ChevronLeft,
  ChevronRight,
  Video,
  MapPin,
  RefreshCw,
  Play,
  Square,
  ClipboardCheck,
  Upload,
  Calendar,
  Users,
  CheckCircle,
} from "lucide-react";

interface CalendarSession {
  id: string;
  title: string;
  time: string;
  duration: string;
  type: "zoom" | "onsite" | "hybrid";
  status: "scheduled" | "live" | "ended" | "completed" | "cancelled";
  venue?: string;
  enrolled: number;
  dayIndex: number; // 0-6 (Sunday-Saturday)
  date: string; // ISO date string (YYYY-MM-DD) for week filtering
}

interface SessionsCalendarWidgetProps {
  sessions: CalendarSession[];
  onStartSession?: (sessionId: string) => void;
  onEndSession?: (sessionId: string) => void;
  onAttendance?: (sessionId: string) => void;
  onShareMaterials?: (sessionId: string) => void;
  /** When true, hides all action buttons on hover (view-only mode) */
  readOnly?: boolean;
}

const SessionsCalendarWidget = ({
  sessions,
  onStartSession,
  onEndSession,
  onAttendance,
  onShareMaterials,
  readOnly = false,
}: SessionsCalendarWidgetProps) => {
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { calendarFormat } = useCalendarPreference();
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);

  // Get week days based on current offset
  const weekDays = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDay + currentWeekOffset * 7);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push({
        date,
        dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
        dayNumber: date.getDate(),
        isToday:
          date.toDateString() === today.toDateString() &&
          currentWeekOffset === 0,
        dayIndex: i,
      });
    }
    return days;
  }, [currentWeekOffset]);

  // Day names for translation
  const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  // Build a set of date strings (YYYY-MM-DD) for the currently displayed week
  const weekDateSet = useMemo(() => {
    const dates = new Set<string>();
    for (const day of weekDays) {
      const y = day.date.getFullYear();
      const m = String(day.date.getMonth() + 1).padStart(2, "0");
      const d = String(day.date.getDate()).padStart(2, "0");
      dates.add(`${y}-${m}-${d}`);
    }
    return dates;
  }, [weekDays]);

  // Group sessions by day, only including sessions that fall within the displayed week
  const sessionsByDay = useMemo(() => {
    const grouped: { [key: number]: CalendarSession[] } = {};
    const seen = new Set<string>();
    for (let i = 0; i < 7; i++) {
      grouped[i] = [];
    }
    sessions.forEach((session) => {
      if (
        grouped[session.dayIndex] &&
        !seen.has(session.id) &&
        weekDateSet.has(session.date)
      ) {
        seen.add(session.id);
        grouped[session.dayIndex].push(session);
      }
    });
    return grouped;
  }, [sessions, weekDateSet]);

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentWeekOffset((prev) =>
      direction === "prev" ? prev - 1 : prev + 1
    );
  };

  const goToToday = () => {
    setCurrentWeekOffset(0);
  };

  // Get month and year for header
  const headerDate = useMemo(() => {
    const firstDay = weekDays[0]?.date;
    const lastDay = weekDays[6]?.date;
    if (!firstDay || !lastDay) return "";

    let firstMonth: string;
    let lastMonth: string;
    let year: number;

    if (calendarFormat === "hijri") {
      const firstParts = getHijriParts(firstDay);
      const lastParts = getHijriParts(lastDay);
      firstMonth = locale === "ar" ? hijriMonthNames[firstParts.month - 1] : hijriMonthNamesEn[firstParts.month - 1];
      lastMonth = locale === "ar" ? hijriMonthNames[lastParts.month - 1] : hijriMonthNamesEn[lastParts.month - 1];
      year = firstParts.year;
    } else {
      firstMonth = locale === "ar" ? gregorianMonthNamesAr[firstDay.getMonth()] : gregorianMonthNames[firstDay.getMonth()];
      lastMonth = locale === "ar" ? gregorianMonthNamesAr[lastDay.getMonth()] : gregorianMonthNames[lastDay.getMonth()];
      year = firstDay.getFullYear();
    }

    if (firstMonth === lastMonth) {
      return `${firstMonth} ${year}`;
    }
    return `${firstMonth} - ${lastMonth} ${year}`;
  }, [weekDays, calendarFormat, locale]);

  const getSessionStyle = (session: CalendarSession) => {
    if (session.status === "completed") {
      return "bg-[#F0FDF4] border-[#BBF7D0] opacity-70";
    }
    if (session.status === "ended") {
      return "bg-[#FEF3C7] border-[#FDE68A]";
    }
    if (session.status === "cancelled") {
      return "bg-[var(--color-border-subtle)] border-[var(--color-border)] opacity-50";
    }
    if (session.status === "live") {
      return "bg-[#FEF2F2] border-[#FECACA] ring-1 ring-[#EF4444]";
    }
    // scheduled
    if (session.type === "zoom") return "bg-[var(--color-border-subtle)] border-[#BFDBFE] hover:border-[var(--color-primary)]";
    if (session.type === "hybrid") return "bg-[#F5F3FF] border-[#DDD6FE] hover:border-[#8B5CF6]";
    return "bg-[#F0FDF4] border-[#BBF7D0] hover:border-[#22C55E]";
  };

  const getTypeIcon = (type: string) => {
    if (type === "zoom") return <Video className="w-3 h-3 text-[var(--color-primary)]" />;
    if (type === "hybrid") return <RefreshCw className="w-3 h-3 text-[#8B5CF6]" />;
    return <MapPin className="w-3 h-3 text-[#22C55E]" />;
  };

  const getTypeColor = (type: string) => {
    if (type === "zoom") return "text-[var(--color-primary)]";
    if (type === "hybrid") return "text-[#8B5CF6]";
    return "text-[#22C55E]";
  };

  const getTypeLabel = (type: string) => {
    if (type === "zoom") return t("sessionsCalendar.zoom");
    if (type === "hybrid") return t("sessionsCalendar.hybrid");
    return t("sessionsCalendar.onsite");
  };

  const renderSessionCard = (session: CalendarSession, isMobile: boolean) => {
    const isCompleted = session.status === "completed";
    const isEnded = session.status === "ended";
    const isCancelled = session.status === "cancelled";
    const isLive = session.status === "live";
    const isScheduled = session.status === "scheduled";

    return (
      <div
        key={session.id}
        className={`relative rounded-lg border transition-all duration-200 overflow-hidden ${getSessionStyle(session)}`}
        onMouseEnter={() => !isMobile && setHoveredSession(session.id)}
        onMouseLeave={() => !isMobile && setHoveredSession(null)}
        onClick={() => isMobile && setHoveredSession(hoveredSession === session.id ? null : session.id)}
      >
        {/* Colored top bar by type */}
        <div className={`h-1 ${
          session.type === "zoom" ? "bg-[var(--color-primary)]" :
          session.type === "hybrid" ? "bg-[#8B5CF6]" : "bg-[#22C55E]"
        }`} />

        <div className="px-2 py-1.5">
          {/* Title + status */}
          <p className={`text-[11px] font-semibold leading-tight truncate ${isCompleted || isCancelled ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-secondary)]"}`}>
            {session.title}
          </p>

          {/* Time */}
          <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">{session.time}</p>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1">
            <span className="flex items-center gap-0.5 text-[9px] text-[var(--color-text-secondary)]">
              <Users className="w-2.5 h-2.5" />
              {session.enrolled}
            </span>
            {isLive && (
              <span className="flex items-center gap-0.5 text-[9px] font-bold text-[#EF4444]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
                LIVE
              </span>
            )}
            {isCompleted && <CheckCircle className="w-2.5 h-2.5 text-[#22C55E]" />}
          </div>
        </div>

        {/* Action overlay on hover — hidden in readOnly mode */}
        {!readOnly && hoveredSession === session.id && !isCancelled && (
          <div className={`${isMobile ? "flex items-center justify-center gap-1 px-2 pb-2" : "absolute inset-x-0 bottom-0 bg-[var(--color-surface-card)]/95 backdrop-blur-sm border-t border-[var(--color-border)] p-1 flex items-center justify-center gap-1"}`}>
            {isScheduled && (
              <button
                onClick={(e) => { e.stopPropagation(); onStartSession?.(session.id); }}
                className="p-1 bg-[var(--color-primary)] text-white rounded hover:bg-[var(--color-primary-dark)] transition-colors"
                title={t("sessionsCalendar.startSession")}
              >
                <Play className="w-3 h-3" />
              </button>
            )}
            {isLive && (
              <button
                onClick={(e) => { e.stopPropagation(); onEndSession?.(session.id); }}
                className="p-1 bg-[#EF4444] text-white rounded hover:bg-[#DC2626] transition-colors"
                title="End Lecture"
              >
                <Square className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onAttendance?.(session.id); }}
              className="p-1 border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
              title={t("sessionsCalendar.attendance")}
            >
              <ClipboardCheck className="w-3 h-3" />
            </button>
            {isScheduled && (
              <button
                onClick={(e) => { e.stopPropagation(); onShareMaterials?.(session.id); }}
                className="p-1 border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                title={t("sessionsCalendar.shareMaterials")}
              >
                <Upload className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 border-b border-[var(--color-border)] gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
          <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
            {t("sessionsCalendar.title")}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeek("prev")}
            className="p-1.5 sm:p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
            aria-label="Previous week"
          >
            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <span className="text-sm font-medium text-[var(--color-text-secondary)] min-w-[120px] text-center">
            {headerDate}
          </span>
          <button
            onClick={() => navigateWeek("next")}
            className="p-1.5 sm:p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
            aria-label="Next week"
          >
            {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {currentWeekOffset !== 0 && (
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-xs sm:text-sm font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
            >
              {t("sessionsCalendar.today")}
            </button>
          )}
        </div>
      </div>

      {/* Week View */}
      <div className="p-4 sm:p-5">
        {/* Desktop View - Full Week Grid */}
        <div className="hidden lg:block">
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, index) => (
              <div key={index} className="min-h-[200px]">
                {/* Day Header */}
                <div
                  className={`text-center pb-2 mb-2 border-b border-[var(--color-border)] ${
                    day.isToday ? "bg-[var(--color-border-subtle)] rounded-t-lg -mx-1 px-1 pt-1" : ""
                  }`}
                >
                  <p
                    className={`text-xs font-medium ${
                      day.isToday ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {t(`sessionsCalendar.days.${dayKeys[index]}`)}
                  </p>
                  <p
                    className={`text-lg font-bold ${
                      day.isToday
                        ? "text-[var(--color-primary)] bg-[var(--color-primary)] text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto"
                        : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    {day.dayNumber}
                  </p>
                </div>

                {/* Sessions for this day */}
                <div className="space-y-2">
                  {sessionsByDay[day.dayIndex]?.map((session) =>
                    renderSessionCard(session, false)
                  )}

                  {/* Empty state for day */}
                  {sessionsByDay[day.dayIndex]?.length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-[10px] text-[var(--color-text-secondary)]">
                        {t("sessionsCalendar.noSessions")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile/Tablet View - Scrollable Cards */}
        <div className="lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {weekDays.map((day, index) => (
              <div
                key={index}
                className={`flex-shrink-0 w-[140px] sm:w-[160px] rounded-lg border ${
                  day.isToday
                    ? "border-[var(--color-primary)] bg-[var(--color-border-subtle)]"
                    : "border-[var(--color-border)]"
                }`}
              >
                {/* Day Header */}
                <div
                  className={`text-center p-2 border-b ${
                    day.isToday ? "border-[#BFDBFE]" : "border-[var(--color-border)]"
                  }`}
                >
                  <p
                    className={`text-xs font-medium ${
                      day.isToday ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {t(`sessionsCalendar.days.${dayKeys[index]}`)}
                  </p>
                  <p
                    className={`text-base font-bold ${
                      day.isToday ? "text-[var(--color-primary)]" : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    {day.dayNumber}
                  </p>
                  {day.isToday && (
                    <span className="text-[10px] text-[var(--color-primary)] font-medium">
                      {t("sessionsCalendar.todayLabel")}
                    </span>
                  )}
                </div>

                {/* Sessions */}
                <div className="p-2 space-y-2 min-h-[120px]">
                  {sessionsByDay[day.dayIndex]?.map((session) =>
                    renderSessionCard(session, true)
                  )}

                  {/* Empty state */}
                  {sessionsByDay[day.dayIndex]?.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-[10px] text-[var(--color-text-secondary)] text-center">
                        {t("sessionsCalendar.noSessions")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-[var(--color-border)] flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[var(--color-border-subtle)] border border-[#BFDBFE]" />
            <span className="text-xs text-[var(--color-text-secondary)]">
              {t("sessionsCalendar.zoomSession")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#F0FDF4] border border-[#BBF7D0]" />
            <span className="text-xs text-[var(--color-text-secondary)]">
              {t("sessionsCalendar.onsiteSession")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#DCFCE7] border border-[#BBF7D0]" />
            <span className="text-xs text-[var(--color-text-secondary)]">Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#FEF2F2] border border-[#FECACA]" />
            <span className="text-xs text-[var(--color-text-secondary)]">Live</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionsCalendarWidget;
