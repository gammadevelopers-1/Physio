"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Video,
  Eye,
  Clock,
  Calendar,
  MapPin,
  Monitor,
  FileText,
  Search,
  List,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import api from "@/lib/api";
import { taApi } from "@/lib/api";

interface AssignedSession {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  type: string;
  scheduledAt: string;
  durationMinutes: number;
  zoomLink: string | null;
  status: string;
  roomName: string | null;
  venueAddress: string | null;
  assistantRole: string;
  assessmentId?: string | null;
}

interface TASessionsContentProps {
  onViewAttendance: (sessionId: string) => void;
  onViewSubmissions: (assessmentId: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────

function getDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatSessionDate(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatSessionTime(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TASessionsContent = ({ onViewAttendance, onViewSubmissions }: TASessionsContentProps) => {
  const t = useTranslations("taDashboard");
  const locale = useLocale();

  // View mode
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Data
  const [sessions, setSessions] = useState<AssignedSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar
  const [calendarDate, setCalendarDate] = useState(new Date());

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await taApi.getMyAssignedSessions({});
      setSessions(data);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Unique courses for filter dropdown
  const uniqueCourses = useMemo(
    () => Array.from(new Map(sessions.map((s) => [s.courseId, s.courseName])).entries()),
    [sessions],
  );

  // Date range validation
  const dateRangeInvalid = !!(filterDateFrom && filterDateTo && filterDateFrom > filterDateTo);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (courseFilter !== "all" && s.courseId !== courseFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!dateRangeInvalid) {
        if (filterDateFrom) {
          const sessionDate = getDateStr(s.scheduledAt);
          if (sessionDate < filterDateFrom) return false;
        }
        if (filterDateTo) {
          const sessionDate = getDateStr(s.scheduledAt);
          if (sessionDate > filterDateTo) return false;
        }
      }
      return true;
    });
  }, [sessions, courseFilter, statusFilter, filterDateFrom, filterDateTo, dateRangeInvalid]);

  // Group sessions for list view
  const todayStr = getTodayStr();
  const todaySessions = useMemo(
    () => filteredSessions.filter((s) => getDateStr(s.scheduledAt) === todayStr && s.status !== "cancelled"),
    [filteredSessions, todayStr],
  );
  const upcomingSessions = useMemo(
    () =>
      filteredSessions
        .filter((s) => {
          const d = getDateStr(s.scheduledAt);
          return d > todayStr && (s.status === "scheduled" || s.status === "live");
        })
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [filteredSessions, todayStr],
  );
  const pastSessions = useMemo(
    () =>
      filteredSessions
        .filter((s) => {
          const d = getDateStr(s.scheduledAt);
          return d < todayStr || s.status === "completed" || s.status === "cancelled";
        })
        .filter((s) => !todaySessions.includes(s))
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [filteredSessions, todayStr, todaySessions],
  );

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: "bg-blue-50 text-blue-700",
      live: "bg-red-50 text-red-700",
      ended: "bg-yellow-50 text-yellow-700",
      completed: "bg-green-50 text-green-700",
      cancelled: "bg-gray-50 text-gray-500",
    };
    return styles[status] || styles.scheduled;
  };

  const getTypeIcon = (type: string) => {
    if (type === "zoom") return <Video className="w-4 h-4" />;
    if (type === "onsite") return <MapPin className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  // Calendar helpers
  const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();
  const monthNames =
    locale === "ar"
      ? ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
      : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames =
    locale === "ar"
      ? ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getSessionsForDate = (day: number) => {
    const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return filteredSessions.filter((s) => getDateStr(s.scheduledAt) === dateStr);
  };

  const getCalendarDotColor = (status: string) => {
    switch (status) {
      case "scheduled": return "bg-[#3B82F6]";
      case "live": return "bg-[#EF4444]";
      case "ended": return "bg-[#D97706]";
      case "completed": return "bg-[#22C55E]";
      case "cancelled": return "bg-[#9CA3AF]";
      default: return "bg-[#3B82F6]";
    }
  };

  // Session card renderer
  const renderSessionCard = (session: AssignedSession) => {
    const date = formatSessionDate(session.scheduledAt, locale);
    const time = formatSessionTime(session.scheduledAt, locale);

    return (
      <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-[#1F2937] truncate">{session.title}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${getStatusBadge(session.status)}`}>
              {session.status === "live" && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mr-1" />
              )}
              {t(`sessions.${session.status}`)}
            </span>
          </div>
          <p className="text-xs text-[#6B7280] mb-1.5">{session.courseName}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B7280]">
            <span className="flex items-center gap-1">
              {getTypeIcon(session.type)}
              {session.type}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {date}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {time} ({session.durationMinutes} {t("sessions.minutes")})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {session.status === "live" && session.zoomLink && (
            <button
              onClick={async () => {
                try {
                  const { joinUrl } = await api.get<{ joinUrl: string }>(`/sessions/${session.id}/ta-join`);
                  window.open(joinUrl, "_blank");
                } catch {
                  window.open(session.zoomLink!, "_blank");
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 btn-gold text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Video className="w-3.5 h-3.5" />
              {t("sessions.joinZoom")}
            </button>
          )}
          {(session.status === "live" || session.status === "ended" || session.status === "completed") && (
            <button
              onClick={() => onViewAttendance(session.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E7EB] text-[#1F2937] rounded-lg text-xs font-medium hover:bg-[#F9FAFB] transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              {t("sessions.viewAttendance")}
            </button>
          )}
          {session.assessmentId && (
            <button
              onClick={() => onViewSubmissions(session.assessmentId!)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E7EB] text-[#1F2937] rounded-lg text-xs font-medium hover:bg-[#F9FAFB] transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              {t("sessions.viewSubmissions")}
            </button>
          )}
        </div>
      </div>
    );
  };

  // Session group renderer
  const renderSessionGroup = (groupTitle: string, groupSessions: AssignedSession[]) => (
    <div className="bg-white rounded-xl border border-[#E5E7EB]">
      <div className="p-4 border-b border-[#E5E7EB]">
        <h2 className="text-base font-semibold text-[#1F2937]">
          {groupTitle}
          <span className="ml-2 text-xs font-normal text-[#6B7280]">({groupSessions.length})</span>
        </h2>
      </div>
      {groupSessions.length === 0 ? (
        <div className="p-8 text-center text-sm text-[#6B7280]">
          {t("sessions.noSessions")}
        </div>
      ) : (
        <div className="divide-y divide-[#E5E7EB]">
          {groupSessions.map(renderSessionCard)}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">{t("sessions.title")}</h1>
          <p className="text-sm text-[#6B7280] mt-1">{t("sessions.subtitle") || "View your assigned training lectures"}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-white border border-[#E5E7EB] rounded-lg p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === "list"
                  ? "btn-gold text-white"
                  : "text-[#6B7280] hover:text-[#1F2937]"
              }`}
            >
              <List className="w-4 h-4" />
              {t("sessions.listView") || "List"}
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === "calendar"
                  ? "btn-gold text-white"
                  : "text-[#6B7280] hover:text-[#1F2937]"
              }`}
            >
              <Calendar className="w-4 h-4" />
              {t("sessions.calendarView") || "Calendar"}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-[#6B7280]">
          <Filter className="w-4 h-4" />
          {t("sessions.filters") || "Filter"}:
        </div>
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-sm bg-white"
        >
          <option value="all">{t("sessions.allCourses")}</option>
          {uniqueCourses.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-sm bg-white"
        >
          <option value="all">{t("sessions.allStatuses")}</option>
          <option value="scheduled">{t("sessions.scheduled")}</option>
          <option value="live">{t("sessions.live")}</option>
          <option value="completed">{t("sessions.completed")}</option>
          <option value="cancelled">{t("sessions.cancelled") || "Cancelled"}</option>
        </select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          className="px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-sm bg-white"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className="px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-sm bg-white"
        />
        {(filterDateFrom || filterDateTo) && (
          <button
            onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
            className="px-2 py-1.5 text-xs text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {dateRangeInvalid && (
        <span className="flex items-center gap-1 text-xs text-[#D97706]">
          <AlertTriangle className="w-3.5 h-3.5" />
          {t("sessions.dateRangeWarning") || "Start date must be before end date"}
        </span>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#6B7280]" />
        </div>
      )}

      {/* List View */}
      {!loading && viewMode === "list" && (
        <div className="space-y-4">
          {renderSessionGroup(t("sessions.today") || "Today", todaySessions)}
          {renderSessionGroup(t("sessions.upcoming") || "Upcoming", upcomingSessions)}
          {renderSessionGroup(t("sessions.past") || "Past", pastSessions)}
        </div>
      )}

      {/* Calendar View */}
      {!loading && viewMode === "calendar" && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
            <button
              onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
              className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-[#6B7280]" />
            </button>
            <h2 className="text-lg font-semibold text-[#1F2937]">
              {monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}
            </h2>
            <button
              onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
              className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-[#6B7280]" />
            </button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-2 border-b border-[#E5E7EB] bg-[#F9FAFB]">
            <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
              {t("sessions.scheduled")}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
              {t("sessions.live")}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
              {t("sessions.completed")}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#9CA3AF]" />
              {t("sessions.cancelled") || "Cancelled"}
            </span>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {/* Day Headers */}
            {dayNames.map((day) => (
              <div key={day} className="p-3 text-center text-xs font-medium text-[#6B7280] border-b border-[#E5E7EB]">
                {day}
              </div>
            ))}

            {/* Empty cells */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] p-2 border-b border-r border-[#E5E7EB] bg-[#F9FAFB]" />
            ))}

            {/* Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const daySessions = getSessionsForDate(day);
              const now = new Date();
              const isToday = now.getDate() === day && now.getMonth() === calendarDate.getMonth() && now.getFullYear() === calendarDate.getFullYear();

              return (
                <div
                  key={day}
                  className={`min-h-[100px] p-2 border-b border-r border-[#E5E7EB] ${isToday ? "bg-[#EFF6FF]" : ""}`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 text-sm ${
                      isToday ? "bg-[#3B82F6] text-white rounded-full font-semibold" : "text-[#1F2937]"
                    }`}
                  >
                    {day}
                  </span>
                  <div className="mt-1 space-y-1">
                    {daySessions.slice(0, 2).map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] truncate cursor-pointer hover:opacity-80"
                        title={`${session.title} - ${formatSessionTime(session.scheduledAt, locale)}`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getCalendarDotColor(session.status)}`} />
                        <span className="truncate text-[#374151]">{session.title}</span>
                      </div>
                    ))}
                    {daySessions.length > 2 && (
                      <div className="text-[10px] text-[#6B7280] px-1.5">
                        +{daySessions.length - 2} {t("sessions.more") || "more"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state when no sessions at all */}
      {!loading && sessions.length === 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
          <Search className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" />
          <p className="text-[#6B7280]">{t("sessions.noSessions")}</p>
        </div>
      )}
    </div>
  );
};

export default TASessionsContent;
