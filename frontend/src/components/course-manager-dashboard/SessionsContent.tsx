"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { useCourseManagerSessions } from "@/hooks/useCourseManagerSessions";
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
} from "lucide-react";

const SessionsContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const manager = useManagerProfile();
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);

  const { sessions, totalPages, loading, error, refetch } =
    useCourseManagerSessions({
      status: statusFilter || undefined,
      page: currentPage,
      limit: 20,
    });

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
                <div className="flex items-center gap-3">
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
                </div>
              </div>

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
                        {todaySessions.map((session) => (
                          <div key={session.id} className="p-4 hover:bg-[#F9FAFB] transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getTypeBadgeStyle(session.type)}`}>{getTypeIcon(session.type)}</div>
                                <div>
                                  <h3 className="text-sm font-semibold text-[#1F2937]">{session.title}</h3>
                                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#6B7280]">
                                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatTime(session.scheduledAt, session.durationMinutes)}</span>
                                    {session.venueAddress && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{session.venueAddress}</span>}
                                  </div>
                                </div>
                              </div>
                              <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(session.status).bg} ${getStatusBadge(session.status).text}`}>{getStatusBadge(session.status).label}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {upcomingSessions.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#E5E7EB]">
                      <div className="p-4 border-b border-[#E5E7EB]">
                        <h2 className="text-base font-semibold text-[#1F2937]">{t("sessionsPage.upcoming")}</h2>
                      </div>
                      <div className="divide-y divide-[#E5E7EB]">
                        {upcomingSessions.map((session) => (
                          <div key={session.id} className="p-4 hover:bg-[#F9FAFB] transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getTypeBadgeStyle(session.type)}`}>{getTypeIcon(session.type)}</div>
                                <div>
                                  <h3 className="text-sm font-semibold text-[#1F2937]">{session.title}</h3>
                                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#6B7280]">
                                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(session.scheduledAt)}</span>
                                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatTime(session.scheduledAt, session.durationMinutes)}</span>
                                  </div>
                                </div>
                              </div>
                              <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getTypeBadgeStyle(session.type)}`}>{session.type}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pastSessions.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#E5E7EB]">
                      <div className="p-4 border-b border-[#E5E7EB]">
                        <h2 className="text-base font-semibold text-[#1F2937]">{t("sessionsPage.past")}</h2>
                      </div>
                      <div className="divide-y divide-[#E5E7EB]">
                        {pastSessions.map((session) => (
                          <div key={session.id} className="p-4 hover:bg-[#F9FAFB] transition-colors opacity-75">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[#F3F4F6] flex items-center justify-center text-[#9CA3AF]">{getTypeIcon(session.type)}</div>
                                <div>
                                  <h3 className="text-sm font-semibold text-[#6B7280]">{session.title}</h3>
                                  <div className="flex items-center gap-3 mt-2 text-xs text-[#9CA3AF]">
                                    <span>{formatDate(session.scheduledAt)}</span>
                                    <span>{formatTime(session.scheduledAt, session.durationMinutes)}</span>
                                  </div>
                                </div>
                              </div>
                              <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(session.status).bg} ${getStatusBadge(session.status).text}`}>{getStatusBadge(session.status).label}</span>
                            </div>
                          </div>
                        ))}
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
    </>
  );
};

export default SessionsContent;
