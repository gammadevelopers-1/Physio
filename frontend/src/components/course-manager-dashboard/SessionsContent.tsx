"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { useCourseManagerSessions } from "@/hooks/useCourseManagerSessions";
import { courseManagerApi } from "@/lib/api";
import {
  Calendar,
  List,
  Video,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CalendarDays,
  Users,
  MoreVertical,
  XCircle,
  CalendarClock,
  UserPlus,
  X,
  Check,
} from "lucide-react";

// 10-color palette for instructor color-coding
const INSTRUCTOR_COLORS = [
  "border-l-[#3B82F6]", "border-l-[#22C55E]", "border-l-[#F59E0B]",
  "border-l-[#EF4444]", "border-l-[#8B5CF6]", "border-l-[#EC4899]",
  "border-l-[#14B8A6]", "border-l-[#F97316]", "border-l-[#6366F1]",
  "border-l-[#84CC16]",
];

// Extended session type with instructor + capacity fields from backend
interface SessionWithInstructor {
  id: string;
  courseId: string;
  instructorId: string;
  title: string;
  type: "zoom" | "onsite" | "hybrid";
  scheduledAt: string;
  durationMinutes: number;
  zoomLink: string | null;
  meetingId: string | null;
  venueAddress: string | null;
  status: "scheduled" | "live" | "completed" | "cancelled";
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  instructorFirstName?: string;
  instructorLastName?: string;
  instructorEmail?: string;
  enrolledCount?: number;
  nelcLimit?: number;
  capacityPercent?: number;
}

interface InstructorOption {
  id: string;
  name: string;
}

const SessionsContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const manager = useManagerProfile();
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [instructorFilter, setInstructorFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [conflicts, setConflicts] = useState<Array<{
    sessionA: { id: string; title: string };
    sessionB: { id: string; title: string };
    instructorName: string;
  }>>([]);

  // Action modal states
  const [actionDropdown, setActionDropdown] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<{ id: string; title: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleModal, setRescheduleModal] = useState<{ id: string; title: string; scheduledAt: string } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [substituteModal, setSubstituteModal] = useState<{ id: string; title: string } | null>(null);
  const [substituteId, setSubstituteId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(false);

  const { sessions: rawSessions, totalPages, loading, error, refetch } =
    useCourseManagerSessions({
      status: statusFilter || undefined,
      instructorId: instructorFilter || undefined,
      page: currentPage,
      limit: 20,
    });

  // Cast to extended type since backend now includes instructor fields
  const sessions = rawSessions as unknown as SessionWithInstructor[];

  // Fetch instructors for filter dropdown
  useEffect(() => {
    courseManagerApi.getInstructors().then((data) => {
      setInstructors(
        data.map((i) => ({
          id: i.id,
          name: `${i.firstName || ""} ${i.lastName || ""}`.trim() || i.email,
        }))
      );
    }).catch(() => {});
  }, []);

  // Fetch conflicts
  useEffect(() => {
    courseManagerApi.getSessionConflicts().then(setConflicts).catch(() => {});
  }, []);

  // Build instructor color map
  const instructorColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const allInstructorIds = [...new Set(sessions.map((s) => s.instructorId).filter(Boolean))];
    allInstructorIds.forEach((id, i) => {
      map.set(id, INSTRUCTOR_COLORS[i % INSTRUCTOR_COLORS.length]);
    });
    return map;
  }, [sessions]);

  // Build conflict set for highlighting
  const conflictSessionIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts.forEach((c) => {
      ids.add(c.sessionA.id);
      ids.add(c.sessionB.id);
    });
    return ids;
  }, [conflicts]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      scheduled: { bg: "bg-[#EFF6FF]", text: "text-[#3B82F6]", label: t("sessionsPage.statusUpcoming") },
      live: { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", label: t("sessionsPage.statusLive") },
      completed: { bg: "bg-[#DCFCE7]", text: "text-[#22C55E]", label: t("sessionsPage.statusCompleted") },
      cancelled: { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]", label: t("sessionsPage.statusCancelled") },
    };
    return styles[status] || styles.scheduled;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "onsite":
        return <MapPin className="w-4 h-4" />;
      case "hybrid":
        return <RefreshCw className="w-4 h-4" />;
      default:
        return <Video className="w-4 h-4" />;
    }
  };

  const getTypeBadgeStyle = (type: string) => {
    const styles: Record<string, string> = {
      zoom: "bg-[#EFF6FF] text-[#3B82F6]",
      onsite: "bg-[#DCFCE7] text-[#22C55E]",
      hybrid: "bg-[#F3E8FF] text-[#9333EA]",
    };
    return styles[type] || styles.zoom;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = (dateStr: string, durationMins: number) => {
    const start = new Date(dateStr);
    const end = new Date(start.getTime() + durationMins * 60000);
    return `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const getInstructorName = (session: SessionWithInstructor) => {
    const first = session.instructorFirstName || "";
    const last = session.instructorLastName || "";
    return `${first} ${last}`.trim() || session.instructorEmail || "";
  };

  const handleCancelOnBehalf = async () => {
    if (!cancelModal || !cancelReason) return;
    setActionLoading(true);
    try {
      await courseManagerApi.cancelSessionOnBehalf(cancelModal.id, cancelReason);
      setActionSuccess(true);
      setTimeout(() => { setCancelModal(null); setCancelReason(""); setActionSuccess(false); refetch(); }, 1200);
    } catch { /* ignore */ }
    setActionLoading(false);
  };

  const handleReschedule = async () => {
    if (!rescheduleModal || !rescheduleDate) return;
    setActionLoading(true);
    try {
      await courseManagerApi.rescheduleSession(rescheduleModal.id, rescheduleDate);
      setActionSuccess(true);
      setTimeout(() => { setRescheduleModal(null); setRescheduleDate(""); setActionSuccess(false); refetch(); }, 1200);
    } catch { /* ignore */ }
    setActionLoading(false);
  };

  const handleAssignSubstitute = async () => {
    if (!substituteModal || !substituteId) return;
    setActionLoading(true);
    try {
      await courseManagerApi.assignSubstitute(substituteModal.id, substituteId);
      setActionSuccess(true);
      setTimeout(() => { setSubstituteModal(null); setSubstituteId(""); setActionSuccess(false); refetch(); }, 1200);
    } catch { /* ignore */ }
    setActionLoading(false);
  };

  const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getSessionsForDate = (day: number) => {
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return sessions.filter((s) => s.scheduledAt.startsWith(dateStr));
  };

  const today = new Date().toISOString().split("T")[0];
  const todaySessions = sessions.filter((s) => s.scheduledAt.startsWith(today));
  const upcomingSessions = sessions.filter(
    (s) => !s.scheduledAt.startsWith(today) && (s.status === "scheduled" || s.status === "live")
  );
  const pastSessions = sessions.filter((s) => s.status === "completed" || s.status === "cancelled");

  const renderSessionRow = (session: SessionWithInstructor, showDate = false, dimmed = false) => {
    const colorClass = instructorColorMap.get(session.instructorId) || "";
    const isConflict = conflictSessionIds.has(session.id);
    const instructorName = getInstructorName(session);

    return (
      <div
        key={session.id}
        className={`p-4 hover:bg-[#F9FAFB] transition-colors border-l-4 ${colorClass} ${dimmed ? "opacity-75" : ""} ${isConflict ? "bg-[#FEF2F2]" : ""}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${dimmed ? "bg-[#F3F4F6] text-[#9CA3AF]" : getTypeBadgeStyle(session.type)}`}>
              {getTypeIcon(session.type)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-semibold ${dimmed ? "text-[#6B7280]" : "text-[#1F2937]"}`}>
                  {session.title}
                </h3>
                {isConflict && (
                  <span className="px-1.5 py-0.5 bg-[#FEE2E2] text-[#EF4444] text-[10px] font-semibold rounded">
                    CONFLICT
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[#6B7280]">
                {showDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(session.scheduledAt)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTime(session.scheduledAt, session.durationMinutes)}
                </span>
                {instructorName && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {instructorName}
                  </span>
                )}
                {session.venueAddress && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {session.venueAddress}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {session.nelcLimit != null && session.nelcLimit > 0 && (
              <div className="flex items-center gap-2 min-w-[120px]">
                <div className="flex-1 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (session.capacityPercent || 0) > 95
                        ? "bg-[#EF4444]"
                        : (session.capacityPercent || 0) > 80
                        ? "bg-[#F59E0B]"
                        : "bg-[#22C55E]"
                    }`}
                    style={{ width: `${Math.min(session.capacityPercent || 0, 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${
                  (session.capacityPercent || 0) > 95
                    ? "text-[#EF4444]"
                    : (session.capacityPercent || 0) > 80
                    ? "text-[#F59E0B]"
                    : "text-[#6B7280]"
                }`}>
                  {session.enrolledCount || 0}/{session.nelcLimit}
                </span>
              </div>
            )}
            <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(session.status).bg} ${getStatusBadge(session.status).text}`}>
              {getStatusBadge(session.status).label}
            </span>
            {/* Action dropdown */}
            {(session.status === "scheduled" || session.status === "live") && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setActionDropdown(actionDropdown === session.id ? null : session.id); }}
                  className="p-1.5 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-[#6B7280]" />
                </button>
                {actionDropdown === session.id && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-10 py-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setActionDropdown(null); setCancelModal({ id: session.id, title: session.title }); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEF2F2]"
                    >
                      <XCircle className="w-4 h-4" /> Cancel Session
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setActionDropdown(null); setRescheduleModal({ id: session.id, title: session.title, scheduledAt: session.scheduledAt }); setRescheduleDate(session.scheduledAt.slice(0, 16)); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1F2937] hover:bg-[#F9FAFB]"
                    >
                      <CalendarClock className="w-4 h-4" /> Reschedule
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setActionDropdown(null); setSubstituteModal({ id: session.id, title: session.title }); setSubstituteId(""); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1F2937] hover:bg-[#F9FAFB]"
                    >
                      <UserPlus className="w-4 h-4" /> Assign Substitute
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">{t("sessionsPage.title")}</h1>
                  <p className="text-sm text-[#6B7280] mt-1">{t("sessionsPage.subtitle")}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center bg-white border border-[#E5E7EB] rounded-lg p-1">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "list" ? "btn-gold text-white" : "text-[#6B7280] hover:text-[#1F2937]"}`}
                    >
                      <List className="w-4 h-4" />
                      {t("sessionsPage.listView")}
                    </button>
                    <button
                      onClick={() => setViewMode("calendar")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "calendar" ? "btn-gold text-white" : "text-[#6B7280] hover:text-[#1F2937]"}`}
                    >
                      <Calendar className="w-4 h-4" />
                      {t("sessionsPage.calendarView")}
                    </button>
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                    className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm bg-white"
                  >
                    <option value="">{t("sessionsPage.allStatuses")}</option>
                    <option value="scheduled">{t("sessionsPage.statusUpcoming")}</option>
                    <option value="live">{t("sessionsPage.statusLive")}</option>
                    <option value="completed">{t("sessionsPage.statusCompleted")}</option>
                    <option value="cancelled">{t("sessionsPage.statusCancelled")}</option>
                  </select>
                  <select
                    value={instructorFilter}
                    onChange={(e) => { setInstructorFilter(e.target.value); setCurrentPage(1); }}
                    className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm bg-white"
                  >
                    <option value="">All Instructors</option>
                    {instructors.map((inst) => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conflict Warning Banner */}
              {conflicts.length > 0 && (
                <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 mb-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-[#991B1B]">
                      {conflicts.length} scheduling conflict{conflicts.length > 1 ? "s" : ""} detected
                    </p>
                    <p className="text-xs text-[#B91C1C] mt-1">
                      {conflicts.slice(0, 3).map((c, i) => (
                        <span key={i}>
                          {c.instructorName}: &quot;{c.sessionA.title}&quot; overlaps with &quot;{c.sessionB.title}&quot;
                          {i < Math.min(conflicts.length, 3) - 1 ? " • " : ""}
                        </span>
                      ))}
                      {conflicts.length > 3 && ` and ${conflicts.length - 3} more...`}
                    </p>
                  </div>
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
                </div>
              )}

              {error && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <AlertTriangle className="w-8 h-8 text-[#EF4444] mx-auto mb-3" />
                  <p className="text-sm text-[#6B7280] mb-4">{error}</p>
                  <button onClick={refetch} className="px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg">{t("dashboard.retry")}</button>
                </div>
              )}

              {!loading && !error && sessions.length === 0 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <CalendarDays className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">{t("sessionsPage.noSessions")}</h3>
                  <p className="text-sm text-[#6B7280]">{t("sessionsPage.noSessionsDesc")}</p>
                </div>
              )}

              {!loading && !error && sessions.length > 0 && viewMode === "list" && (
                <div className="space-y-4">
                  {todaySessions.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#E5E7EB]">
                      <div className="p-4 border-b border-[#E5E7EB]">
                        <h2 className="text-base font-semibold text-[#1F2937]">{t("sessionsPage.today")}</h2>
                      </div>
                      <div className="divide-y divide-[#E5E7EB]">
                        {todaySessions.map((session) => renderSessionRow(session))}
                      </div>
                    </div>
                  )}

                  {upcomingSessions.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#E5E7EB]">
                      <div className="p-4 border-b border-[#E5E7EB]">
                        <h2 className="text-base font-semibold text-[#1F2937]">{t("sessionsPage.upcoming")}</h2>
                      </div>
                      <div className="divide-y divide-[#E5E7EB]">
                        {upcomingSessions.map((session) => renderSessionRow(session, true))}
                      </div>
                    </div>
                  )}

                  {pastSessions.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#E5E7EB]">
                      <div className="p-4 border-b border-[#E5E7EB]">
                        <h2 className="text-base font-semibold text-[#1F2937]">{t("sessionsPage.past")}</h2>
                      </div>
                      <div className="divide-y divide-[#E5E7EB]">
                        {pastSessions.map((session) => renderSessionRow(session, true, true))}
                      </div>
                    </div>
                  )}

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <button disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
                      <span className="text-sm text-[#6B7280]">{currentPage} / {totalPages}</span>
                      <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              )}

              {!loading && !error && viewMode === "calendar" && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
                    <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))} className="p-2 hover:bg-[#F3F4F6] rounded-lg"><ChevronLeft className="w-5 h-5 text-[#6B7280]" /></button>
                    <h2 className="text-lg font-semibold text-[#1F2937]">{monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}</h2>
                    <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))} className="p-2 hover:bg-[#F3F4F6] rounded-lg"><ChevronRight className="w-5 h-5 text-[#6B7280]" /></button>
                  </div>
                  <div className="grid grid-cols-7">
                    {dayNames.map((day) => (<div key={day} className="p-3 text-center text-xs font-medium text-[#6B7280] border-b border-[#E5E7EB]">{day}</div>))}
                    {Array.from({ length: firstDayOfMonth }).map((_, i) => (<div key={`empty-${i}`} className="min-h-[100px] p-2 border-b border-r border-[#E5E7EB] bg-[#F9FAFB]" />))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const daySessions = getSessionsForDate(day);
                      const isToday = new Date().getDate() === day && new Date().getMonth() === selectedDate.getMonth();
                      return (
                        <div key={day} className={`min-h-[100px] p-2 border-b border-r border-[#E5E7EB] ${isToday ? "bg-[#EFF6FF]" : ""}`}>
                          <span className={`inline-flex items-center justify-center w-7 h-7 text-sm ${isToday ? "bg-[#3B82F6] text-white rounded-full font-semibold" : "text-[#1F2937]"}`}>{day}</span>
                          <div className="mt-1 space-y-1">
                            {daySessions.slice(0, 2).map((session) => (<div key={session.id} className={`px-1.5 py-0.5 rounded text-[10px] truncate ${getTypeBadgeStyle(session.type)}`} title={session.title}>{session.title}</div>))}
                            {daySessions.length > 2 && (<div className="text-[10px] text-[#6B7280] px-1.5">+{daySessions.length - 2} more</div>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1F2937]">Cancel Session</h3>
              <button onClick={() => setCancelModal(null)} className="p-1 hover:bg-[#F3F4F6] rounded-lg"><X className="w-5 h-5 text-[#6B7280]" /></button>
            </div>
            {actionSuccess ? (
              <div className="text-center py-6">
                <Check className="w-8 h-8 text-[#22C55E] mx-auto mb-2" />
                <p className="text-sm font-medium text-[#1F2937]">Session cancelled</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-[#6B7280] mb-3">Cancel &quot;{cancelModal.title}&quot;? Please provide a reason:</p>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation..."
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm mb-4 focus:ring-2 focus:ring-[#3B82F6] outline-none resize-none h-24"
                />
                <div className="flex justify-end gap-3">
                  <button onClick={() => setCancelModal(null)} className="px-4 py-2 text-sm text-[#6B7280] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB]">Close</button>
                  <button onClick={handleCancelOnBehalf} disabled={!cancelReason || actionLoading} className="px-4 py-2 text-sm font-medium text-white bg-[#EF4444] rounded-lg disabled:opacity-50 inline-flex items-center gap-2 hover:bg-[#DC2626]">
                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}Cancel Session
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1F2937]">Reschedule Session</h3>
              <button onClick={() => setRescheduleModal(null)} className="p-1 hover:bg-[#F3F4F6] rounded-lg"><X className="w-5 h-5 text-[#6B7280]" /></button>
            </div>
            {actionSuccess ? (
              <div className="text-center py-6">
                <Check className="w-8 h-8 text-[#22C55E] mx-auto mb-2" />
                <p className="text-sm font-medium text-[#1F2937]">Session rescheduled</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-[#6B7280] mb-3">Reschedule &quot;{rescheduleModal.title}&quot;:</p>
                <input
                  type="datetime-local"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm mb-4 focus:ring-2 focus:ring-[#3B82F6] outline-none"
                />
                <div className="flex justify-end gap-3">
                  <button onClick={() => setRescheduleModal(null)} className="px-4 py-2 text-sm text-[#6B7280] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB]">Close</button>
                  <button onClick={handleReschedule} disabled={!rescheduleDate || actionLoading} className="px-4 py-2 text-sm font-medium text-white btn-gold rounded-lg disabled:opacity-50 inline-flex items-center gap-2">
                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}Reschedule
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Assign Substitute Modal */}
      {substituteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1F2937]">Assign Substitute</h3>
              <button onClick={() => setSubstituteModal(null)} className="p-1 hover:bg-[#F3F4F6] rounded-lg"><X className="w-5 h-5 text-[#6B7280]" /></button>
            </div>
            {actionSuccess ? (
              <div className="text-center py-6">
                <Check className="w-8 h-8 text-[#22C55E] mx-auto mb-2" />
                <p className="text-sm font-medium text-[#1F2937]">Substitute assigned</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-[#6B7280] mb-3">Select substitute for &quot;{substituteModal.title}&quot;:</p>
                <select
                  value={substituteId}
                  onChange={(e) => setSubstituteId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm mb-4 focus:ring-2 focus:ring-[#3B82F6] outline-none"
                >
                  <option value="">Select instructor...</option>
                  {instructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setSubstituteModal(null)} className="px-4 py-2 text-sm text-[#6B7280] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB]">Close</button>
                  <button onClick={handleAssignSubstitute} disabled={!substituteId || actionLoading} className="px-4 py-2 text-sm font-medium text-white btn-gold rounded-lg disabled:opacity-50 inline-flex items-center gap-2">
                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}Assign
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SessionsContent;
