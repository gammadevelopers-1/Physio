"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
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
  status: "scheduled" | "live" | "completed" | "cancelled";
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
}

const SessionsCalendarWidget = ({
  sessions,
  onStartSession,
  onEndSession,
  onAttendance,
  onShareMaterials,
}: SessionsCalendarWidgetProps) => {
  const t = useTranslations("instructorDashboard");
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

    const firstMonth = firstDay.toLocaleDateString("en-US", { month: "short" });
    const lastMonth = lastDay.toLocaleDateString("en-US", { month: "short" });
    const year = firstDay.getFullYear();

    if (firstMonth === lastMonth) {
      return `${firstMonth} ${year}`;
    }
    return `${firstMonth} - ${lastMonth} ${year}`;
  }, [weekDays]);

  const getSessionStyle = (session: CalendarSession) => {
    if (session.status === "completed") {
      return "bg-[#F0FDF4] border-[#BBF7D0] opacity-70";
    }
    if (session.status === "cancelled") {
      return "bg-[#F3F4F6] border-[#E5E7EB] opacity-50";
    }
    if (session.status === "live") {
      return "bg-[#FEF2F2] border-[#FECACA] ring-1 ring-[#EF4444]";
    }
    // scheduled
    if (session.type === "zoom") return "bg-[#EFF6FF] border-[#BFDBFE] hover:border-[#3B82F6]";
    if (session.type === "hybrid") return "bg-[#F5F3FF] border-[#DDD6FE] hover:border-[#8B5CF6]";
    return "bg-[#F0FDF4] border-[#BBF7D0] hover:border-[#22C55E]";
  };

  const getTypeIcon = (type: string) => {
    if (type === "zoom") return <Video className="w-3 h-3 text-[#3B82F6]" />;
    if (type === "hybrid") return <RefreshCw className="w-3 h-3 text-[#8B5CF6]" />;
    return <MapPin className="w-3 h-3 text-[#22C55E]" />;
  };

  const getTypeColor = (type: string) => {
    if (type === "zoom") return "text-[#3B82F6]";
    if (type === "hybrid") return "text-[#8B5CF6]";
    return "text-[#22C55E]";
  };

  const getTypeLabel = (type: string) => {
    if (type === "zoom") return t("sessionsCalendar.zoom");
    if (type === "hybrid") return "Hybrid";
    return t("sessionsCalendar.onsite");
  };

  const renderSessionCard = (session: CalendarSession, isMobile: boolean) => {
    const isCompleted = session.status === "completed";
    const isCancelled = session.status === "cancelled";
    const isLive = session.status === "live";
    const isScheduled = session.status === "scheduled";

    return (
      <div
        key={session.id}
        className={`relative p-2 rounded-lg border cursor-pointer transition-all duration-200 ${getSessionStyle(session)}`}
        onMouseEnter={() => !isMobile && setHoveredSession(session.id)}
        onMouseLeave={() => !isMobile && setHoveredSession(null)}
        onClick={() => isMobile && setHoveredSession(hoveredSession === session.id ? null : session.id)}
      >
        {/* Type + Status Badges */}
        <div className="flex items-center gap-1 mb-1 flex-wrap">
          {getTypeIcon(session.type)}
          <span className={`text-[10px] font-medium ${getTypeColor(session.type)}`}>
            {getTypeLabel(session.type)}
          </span>
          {isCompleted && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium text-[#22C55E]">
              <CheckCircle className="w-2.5 h-2.5" />
            </span>
          )}
          {isLive && (
            <span className="flex items-center gap-0.5 px-1 py-0.5 bg-[#FEE2E2] rounded text-[9px] font-bold text-[#EF4444]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
              LIVE
            </span>
          )}
          {isCancelled && (
            <span className="text-[9px] font-medium text-[#9CA3AF] line-through">Cancelled</span>
          )}
        </div>

        {/* Session Title */}
        <p className={`text-xs font-medium line-clamp-2 mb-1 ${isCompleted || isCancelled ? "text-[#6B7280]" : "text-[#1F2937]"}`}>
          {session.title}
        </p>

        {/* Time */}
        <p className="text-[10px] text-[#6B7280]">{session.time}</p>

        {/* Venue for on-site/hybrid */}
        {(session.type === "onsite" || session.type === "hybrid") && session.venue && (
          <p className="text-[10px] text-[#6B7280] truncate">{session.venue}</p>
        )}

        {/* Enrolled count */}
        <div className="flex items-center gap-1 mt-1">
          <Users className="w-2.5 h-2.5 text-[#9CA3AF]" />
          <span className="text-[10px] text-[#9CA3AF]">{session.enrolled}</span>
        </div>

        {/* Action Buttons - Show on Hover/Tap - Status aware */}
        {hoveredSession === session.id && !isCancelled && (
          <div className={`${isMobile ? "flex items-center justify-center gap-1 mt-2 pt-2 border-t border-[#E5E7EB]" : "absolute bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] rounded-b-lg p-1.5 flex items-center justify-center gap-1 shadow-sm"}`}>
            {isScheduled && (
              <button
                onClick={(e) => { e.stopPropagation(); onStartSession?.(session.id); }}
                className={`${isMobile ? "flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium" : "p-1"} bg-[#3B82F6] text-white rounded hover:bg-[#2563EB] transition-colors`}
                title={t("sessionsCalendar.startSession")}
              >
                <Play className="w-3 h-3" />
                {isMobile && t("sessionsCalendar.start")}
              </button>
            )}
            {isLive && (
              <button
                onClick={(e) => { e.stopPropagation(); onEndSession?.(session.id); }}
                className={`${isMobile ? "flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium" : "p-1"} bg-[#EF4444] text-white rounded hover:bg-[#DC2626] transition-colors`}
                title="End Session"
              >
                <Square className="w-3 h-3" />
                {isMobile && "End"}
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onAttendance?.(session.id); }}
              className="p-1 border border-[#E5E7EB] rounded text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
              title={t("sessionsCalendar.attendance")}
            >
              <ClipboardCheck className="w-3 h-3" />
            </button>
            {isScheduled && (
              <button
                onClick={(e) => { e.stopPropagation(); onShareMaterials?.(session.id); }}
                className="p-1 border border-[#E5E7EB] rounded text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
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
    <div className="bg-white rounded-xl border border-[#E5E7EB]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 border-b border-[#E5E7EB] gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#3B82F6]" />
          <h2 className="text-base sm:text-lg font-semibold text-[#1F2937]">
            {t("sessionsCalendar.title")}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeek("prev")}
            className="p-1.5 sm:p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-[#374151] min-w-[120px] text-center">
            {headerDate}
          </span>
          <button
            onClick={() => navigateWeek("next")}
            className="p-1.5 sm:p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {currentWeekOffset !== 0 && (
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-xs sm:text-sm font-medium text-[#3B82F6] border border-[#3B82F6] rounded-lg hover:bg-[#EFF6FF] transition-colors"
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
                  className={`text-center pb-2 mb-2 border-b border-[#E5E7EB] ${
                    day.isToday ? "bg-[#EFF6FF] rounded-t-lg -mx-1 px-1 pt-1" : ""
                  }`}
                >
                  <p
                    className={`text-xs font-medium ${
                      day.isToday ? "text-[#3B82F6]" : "text-[#6B7280]"
                    }`}
                  >
                    {t(`sessionsCalendar.days.${dayKeys[index]}`)}
                  </p>
                  <p
                    className={`text-lg font-bold ${
                      day.isToday
                        ? "text-[#3B82F6] bg-[#3B82F6] text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto"
                        : "text-[#1F2937]"
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
                      <p className="text-[10px] text-[#9CA3AF]">
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
                    ? "border-[#3B82F6] bg-[#EFF6FF]"
                    : "border-[#E5E7EB]"
                }`}
              >
                {/* Day Header */}
                <div
                  className={`text-center p-2 border-b ${
                    day.isToday ? "border-[#BFDBFE]" : "border-[#E5E7EB]"
                  }`}
                >
                  <p
                    className={`text-xs font-medium ${
                      day.isToday ? "text-[#3B82F6]" : "text-[#6B7280]"
                    }`}
                  >
                    {t(`sessionsCalendar.days.${dayKeys[index]}`)}
                  </p>
                  <p
                    className={`text-base font-bold ${
                      day.isToday ? "text-[#3B82F6]" : "text-[#1F2937]"
                    }`}
                  >
                    {day.dayNumber}
                  </p>
                  {day.isToday && (
                    <span className="text-[10px] text-[#3B82F6] font-medium">
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
                      <p className="text-[10px] text-[#9CA3AF] text-center">
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
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-[#E5E7EB] flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#EFF6FF] border border-[#BFDBFE]" />
            <span className="text-xs text-[#6B7280]">
              {t("sessionsCalendar.zoomSession")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#F0FDF4] border border-[#BBF7D0]" />
            <span className="text-xs text-[#6B7280]">
              {t("sessionsCalendar.onsiteSession")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#DCFCE7] border border-[#BBF7D0]" />
            <span className="text-xs text-[#6B7280]">Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#FEF2F2] border border-[#FECACA]" />
            <span className="text-xs text-[#6B7280]">Live</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionsCalendarWidget;
