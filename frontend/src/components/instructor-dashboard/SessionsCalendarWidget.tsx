"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  Video,
  MapPin,
  Play,
  ClipboardCheck,
  Upload,
  Calendar,
  Users,
} from "lucide-react";

interface CalendarSession {
  id: string;
  title: string;
  time: string;
  duration: string;
  type: "zoom" | "onsite";
  venue?: string;
  enrolled: number;
  dayIndex: number; // 0-6 (Sunday-Saturday)
}

interface SessionsCalendarWidgetProps {
  sessions: CalendarSession[];
  onStartSession?: (sessionId: string) => void;
  onAttendance?: (sessionId: string) => void;
  onShareMaterials?: (sessionId: string) => void;
}

const SessionsCalendarWidget = ({
  sessions,
  onStartSession,
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

  // Group sessions by day
  const sessionsByDay = useMemo(() => {
    const grouped: { [key: number]: CalendarSession[] } = {};
    for (let i = 0; i < 7; i++) {
      grouped[i] = [];
    }
    sessions.forEach((session) => {
      if (grouped[session.dayIndex]) {
        grouped[session.dayIndex].push(session);
      }
    });
    return grouped;
  }, [sessions]);

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
                  {sessionsByDay[day.dayIndex]?.map((session) => (
                    <div
                      key={session.id}
                      className={`relative p-2 rounded-lg border cursor-pointer transition-all duration-200 ${
                        session.type === "zoom"
                          ? "bg-[#EFF6FF] border-[#BFDBFE] hover:border-[#3B82F6]"
                          : "bg-[#F0FDF4] border-[#BBF7D0] hover:border-[#22C55E]"
                      }`}
                      onMouseEnter={() => setHoveredSession(session.id)}
                      onMouseLeave={() => setHoveredSession(null)}
                    >
                      {/* Type Badge */}
                      <div className="flex items-center gap-1 mb-1">
                        {session.type === "zoom" ? (
                          <Video className="w-3 h-3 text-[#3B82F6]" />
                        ) : (
                          <MapPin className="w-3 h-3 text-[#22C55E]" />
                        )}
                        <span
                          className={`text-[10px] font-medium ${
                            session.type === "zoom"
                              ? "text-[#3B82F6]"
                              : "text-[#22C55E]"
                          }`}
                        >
                          {session.type === "zoom"
                            ? t("sessionsCalendar.zoom")
                            : t("sessionsCalendar.onsite")}
                        </span>
                      </div>

                      {/* Session Title */}
                      <p className="text-xs font-medium text-[#1F2937] line-clamp-2 mb-1">
                        {session.title}
                      </p>

                      {/* Time */}
                      <p className="text-[10px] text-[#6B7280]">
                        {session.time}
                      </p>

                      {/* Venue for on-site */}
                      {session.type === "onsite" && session.venue && (
                        <p className="text-[10px] text-[#6B7280] truncate">
                          {session.venue}
                        </p>
                      )}

                      {/* Enrolled count */}
                      <div className="flex items-center gap-1 mt-1">
                        <Users className="w-2.5 h-2.5 text-[#9CA3AF]" />
                        <span className="text-[10px] text-[#9CA3AF]">
                          {session.enrolled}
                        </span>
                      </div>

                      {/* Action Buttons - Show on Hover */}
                      {hoveredSession === session.id && (
                        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] rounded-b-lg p-1.5 flex items-center justify-center gap-1 shadow-sm">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartSession?.(session.id);
                            }}
                            className="p-1 bg-[#3B82F6] text-white rounded hover:bg-[#2563EB] transition-colors"
                            title={t("sessionsCalendar.startSession")}
                          >
                            <Play className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAttendance?.(session.id);
                            }}
                            className="p-1 border border-[#E5E7EB] rounded text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                            title={t("sessionsCalendar.attendance")}
                          >
                            <ClipboardCheck className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onShareMaterials?.(session.id);
                            }}
                            className="p-1 border border-[#E5E7EB] rounded text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                            title={t("sessionsCalendar.shareMaterials")}
                          >
                            <Upload className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

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
                  {sessionsByDay[day.dayIndex]?.map((session) => (
                    <div
                      key={session.id}
                      className={`p-2 rounded-lg border ${
                        session.type === "zoom"
                          ? "bg-white border-[#BFDBFE]"
                          : "bg-white border-[#BBF7D0]"
                      }`}
                      onClick={() => setHoveredSession(hoveredSession === session.id ? null : session.id)}
                    >
                      {/* Type Badge */}
                      <div className="flex items-center gap-1 mb-1">
                        {session.type === "zoom" ? (
                          <Video className="w-3 h-3 text-[#3B82F6]" />
                        ) : (
                          <MapPin className="w-3 h-3 text-[#22C55E]" />
                        )}
                        <span
                          className={`text-[10px] font-medium ${
                            session.type === "zoom"
                              ? "text-[#3B82F6]"
                              : "text-[#22C55E]"
                          }`}
                        >
                          {session.type === "zoom"
                            ? t("sessionsCalendar.zoom")
                            : t("sessionsCalendar.onsite")}
                        </span>
                      </div>

                      {/* Session Title */}
                      <p className="text-xs font-medium text-[#1F2937] line-clamp-2 mb-1">
                        {session.title}
                      </p>

                      {/* Time */}
                      <p className="text-[10px] text-[#6B7280] mb-1">
                        {session.time}
                      </p>

                      {/* Venue for on-site */}
                      {session.type === "onsite" && session.venue && (
                        <p className="text-[10px] text-[#6B7280] truncate mb-1">
                          📍 {session.venue}
                        </p>
                      )}

                      {/* Enrolled */}
                      <div className="flex items-center gap-1">
                        <Users className="w-2.5 h-2.5 text-[#9CA3AF]" />
                        <span className="text-[10px] text-[#9CA3AF]">
                          {session.enrolled} {t("sessionsCalendar.enrolled")}
                        </span>
                      </div>

                      {/* Action Buttons - Show on tap (mobile) */}
                      {hoveredSession === session.id && (
                        <div className="flex items-center justify-center gap-1 mt-2 pt-2 border-t border-[#E5E7EB]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartSession?.(session.id);
                            }}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#3B82F6] text-white text-[10px] font-medium rounded hover:bg-[#2563EB] transition-colors"
                          >
                            <Play className="w-3 h-3" />
                            {t("sessionsCalendar.start")}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAttendance?.(session.id);
                            }}
                            className="p-1.5 border border-[#E5E7EB] rounded text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                            title={t("sessionsCalendar.attendance")}
                          >
                            <ClipboardCheck className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onShareMaterials?.(session.id);
                            }}
                            className="p-1.5 border border-[#E5E7EB] rounded text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                            title={t("sessionsCalendar.shareMaterials")}
                          >
                            <Upload className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

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
        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-[#E5E7EB]">
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
        </div>
      </div>
    </div>
  );
};

export default SessionsCalendarWidget;
