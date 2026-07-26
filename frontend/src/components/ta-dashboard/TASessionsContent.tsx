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
  Filter,
  X,
  Loader2,
  AlertTriangle,
  Radio,
} from "lucide-react";
import { taApi } from "@/lib/api";
import DatePicker from "@/components/ui/DatePicker";
import Select from "@/components/admin-dashboard/Select";
import SessionsCalendarWidget from "../instructor-dashboard/SessionsCalendarWidget";
import TASessionJoinButton from "./TASessionJoinButton";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import { formatPlatformDate, formatPlatformTime, type PlatformLocaleSettings } from "@/lib/platform-locale";

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
  isWebinar?: boolean | null;
  webinarRegistrationUrl?: string | null;
}

interface TASessionsContentProps {
  onViewAttendance: (sessionId: string, sessionInfo?: { scheduledAt: string; durationMinutes: number; title: string; type: string; status: string; courseId: string; zoomLink: string | null }) => void;
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

function formatSessionDate(iso: string, settings: PlatformLocaleSettings): string {
  return formatPlatformDate(iso, settings);
}

function formatSessionTime(iso: string, settings: PlatformLocaleSettings, locale: string): string {
  return formatPlatformTime(iso, settings, locale === "ar" ? "ar" : "en");
}

const TASessionsContent = ({ onViewAttendance, onViewSubmissions }: TASessionsContentProps) => {
  const t = useTranslations("taDashboard");
  const locale = useLocale();
  const platformLocale = usePlatformLocale();

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
      cancelled: "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]",
      missed: "bg-red-50 text-red-700",
      rescheduled: "bg-yellow-50 text-yellow-700",
    };
    return styles[status] || styles.scheduled;
  };

  const getTypeIcon = (type: string) => {
    if (type === "zoom") return <Video className="w-4 h-4" />;
    if (type === "onsite") return <MapPin className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  // Map filteredSessions → shape expected by the shared SessionsCalendarWidget.
  const widgetSessions = useMemo(() => {
    return filteredSessions.map((s) => {
      const scheduledDate = new Date(s.scheduledAt);
      const endDate = new Date(scheduledDate.getTime() + s.durationMinutes * 60 * 1000);
      const fmt = (d: Date) =>
        d.toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      const known = new Set(["zoom", "onsite", "hybrid"]);
      const type = (known.has(s.type) ? s.type : "onsite") as "zoom" | "onsite" | "hybrid";
      const knownStatus = new Set(["scheduled", "live", "ended", "completed", "cancelled"]);
      const status = (knownStatus.has(s.status) ? s.status : "scheduled") as
        | "scheduled" | "live" | "ended" | "completed" | "cancelled";
      return {
        id: s.id,
        title: s.title,
        time: `${fmt(scheduledDate)} - ${fmt(endDate)}`,
        duration: `${s.durationMinutes} mins`,
        type,
        status,
        venue: s.roomName || s.venueAddress || undefined,
        enrolled: 0,
        dayIndex: scheduledDate.getDay(),
        date: scheduledDate.toLocaleDateString("en-CA"),
      };
    });
  }, [filteredSessions, locale]);

  // Session card renderer
  const renderSessionCard = (session: AssignedSession) => {
    const date = formatSessionDate(session.scheduledAt, platformLocale);
    const time = formatSessionTime(session.scheduledAt, platformLocale, locale);

    return (
      <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{session.title}</h3>
            {session.isWebinar && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#A855F7] text-white text-[10px] font-bold rounded-full uppercase tracking-wide flex-shrink-0">
                <Radio className="w-2.5 h-2.5" />
                {t("sessionTypes.webinar")}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${getStatusBadge(session.status)}`}>
              {session.status === "live" && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse me-1" />
              )}
              {t(`sessions.${session.status}`)}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mb-1.5">{session.courseName}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)]">
            <span className="flex items-center gap-1">
              {getTypeIcon(session.type)}
              {t.has(`sessionTypes.${session.type}`)
                ? t(`sessionTypes.${session.type}`)
                : session.type}
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
          {(session.type === "zoom" || session.type === "hybrid") && (
            <TASessionJoinButton
              sessionId={session.id}
              scheduledAt={session.scheduledAt}
              durationMinutes={session.durationMinutes}
              status={session.status}
            />
          )}
          {(session.status === "live" || session.status === "ended" || session.status === "completed") && (
            <button
              onClick={() => onViewAttendance(session.id, { scheduledAt: session.scheduledAt, durationMinutes: session.durationMinutes, title: session.title, type: session.type, status: session.status, courseId: session.courseId, zoomLink: session.zoomLink })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg text-xs font-medium hover:bg-[var(--color-border-subtle)] transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              {t("sessions.viewAttendance")}
            </button>
          )}
          {session.assessmentId && (
            <button
              onClick={() => onViewSubmissions(session.assessmentId!)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg text-xs font-medium hover:bg-[var(--color-border-subtle)] transition-colors"
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
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
      <div className="p-4 border-b border-[var(--color-border)]">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          {groupTitle}
          <span className="ms-2 text-xs font-normal text-[var(--color-text-secondary)]">({groupSessions.length})</span>
        </h2>
      </div>
      {groupSessions.length === 0 ? (
        <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
          {t("sessions.noSessions")}
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
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
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t("sessions.title")}</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t("sessions.subtitle") || "View your assigned training lectures"}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === "list"
                  ? "btn-gold text-[var(--color-button-text)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <List className="w-4 h-4" />
              {t("sessions.listView") || "List"}
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === "calendar"
                  ? "btn-gold text-[var(--color-button-text)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
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
        <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
          <Filter className="w-4 h-4" />
          {t("sessions.filters") || "Filter"}:
        </div>
        <Select
          size="sm"
          className="min-w-[180px]"
          value={courseFilter}
          onChange={setCourseFilter}
          ariaLabel={t("sessions.allCourses")}
          options={[
            { value: "all", label: t("sessions.allCourses") },
            ...uniqueCourses.map(([id, name]) => ({ value: id, label: name })),
          ]}
        />
        <Select
          size="sm"
          className="min-w-[160px]"
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel={t("sessions.allStatuses")}
          options={[
            { value: "all", label: t("sessions.allStatuses") },
            { value: "scheduled", label: t("sessions.scheduled") },
            { value: "live", label: t("sessions.live") },
            { value: "completed", label: t("sessions.completed") },
            { value: "cancelled", label: t("sessions.cancelled") || "Cancelled" },
          ]}
        />
        <DatePicker value={filterDateFrom} onChange={setFilterDateFrom} />
        <DatePicker value={filterDateTo} onChange={setFilterDateTo} min={filterDateFrom || undefined} />
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
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-secondary)]" />
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

      {/* Calendar View — uses the shared SessionsCalendarWidget (Hijri-aware,
          RTL-safe chevrons, year+month picker, Today button). Read-only from
          the TA's perspective; taps open the attendance drawer through the
          onAttendance callback. */}
      {!loading && viewMode === "calendar" && (
        <SessionsCalendarWidget
          sessions={widgetSessions}
          onAttendance={(sessionId) => {
            const s = filteredSessions.find((x) => x.id === sessionId);
            if (!s) return;
            onViewAttendance(sessionId, {
              scheduledAt: s.scheduledAt,
              durationMinutes: s.durationMinutes,
              title: s.title,
              type: s.type,
              status: s.status,
              courseId: s.courseId,
              zoomLink: s.zoomLink,
            });
          }}
        />
      )}

      {/* Empty state when no sessions at all */}
      {!loading && sessions.length === 0 && (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-8 text-center">
          <Search className="w-12 h-12 text-[var(--color-text-secondary)] mx-auto mb-3" />
          <p className="text-[var(--color-text-secondary)]">{t("sessions.noSessions")}</p>
        </div>
      )}
    </div>
  );
};

export default TASessionsContent;
