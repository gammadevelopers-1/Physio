"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import {
  Video,
  Eye,
  Clock,
  Calendar,
  CalendarDays,
  MapPin,
  Monitor,
  BookOpen,
  Bell,
} from "lucide-react";
import TASidebar from "./TASidebar";
import TANavbar from "./TANavbar";
import TASessionsContent from "./TASessionsContent";
import TAAttendanceView from "./TAAttendanceView";
import TAAssessmentSubmissionsView from "./TAAssessmentSubmissionsView";
import SessionsCalendarWidget from "../instructor-dashboard/SessionsCalendarWidget";
import api from "@/lib/api";
import { taApi, userNotificationsApi } from "@/lib/api";
import type { TAAssignedCourse, UserNotification } from "@/lib/api";

type TAView = "home" | "sessions" | "attendance" | "submissions";

interface TADashboardContentProps {
  initialView?: TAView;
}

interface AssignedSession {
  id: string;
  courseId: string;
  courseName: string;
  instructorId: string;
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

function formatRelativeDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

const TADashboardContent = ({
  initialView = "home",
}: TADashboardContentProps) => {
  const t = useTranslations("taDashboard");
  const locale = useLocale();
  const [currentView, setCurrentView] = useState<TAView>(initialView);
  const [todaySessions, setTodaySessions] = useState<AssignedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [selectedSessionInfo, setSelectedSessionInfo] = useState<{
    scheduledAt: string; durationMinutes: number; title: string; type: string;
    status: string; courseId: string; zoomLink: string | null;
  } | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<
    string | null
  >(null);
  const [weekSessions, setWeekSessions] = useState<AssignedSession[]>([]);
  const [courses, setCourses] = useState<TAAssignedCourse[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [upcomingSessions, setUpcomingSessions] = useState<AssignedSession[]>(
    []
  );

  const fetchTodaySessions = useCallback(async () => {
    try {
      setLoading(true);
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      ).toISOString();
      const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 1
      ).toISOString();
      const data = await taApi.getMyAssignedSessions({
        dateRange: `${startOfDay},${endOfDay}`,
      });
      setTodaySessions(data);
    } catch {
      setTodaySessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWeekSessions = useCallback(async () => {
    try {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - dayOfWeek
      );
      const endOfWeek = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + (7 - dayOfWeek)
      );
      const data = await taApi.getMyAssignedSessions({
        dateRange: `${startOfWeek.toISOString()},${endOfWeek.toISOString()}`,
      });
      setWeekSessions(data);
    } catch {
      setWeekSessions([]);
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    try {
      const data = await taApi.getMyAssignedCourses();
      setCourses(data);
    } catch {
      setCourses([]);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data, unreadCount: count } = await userNotificationsApi.getAll({
        limit: 10,
      });
      setNotifications(data);
      setUnreadCount(count);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, []);

  const fetchUpcomingSessions = useCallback(async () => {
    try {
      const data = await taApi.getMyAssignedSessions({ status: "scheduled" });
      const now = new Date();
      const future = data
        .filter((s) => new Date(s.scheduledAt) > now)
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime()
        );
      setUpcomingSessions(future);
    } catch {
      setUpcomingSessions([]);
    }
  }, []);

  useEffect(() => {
    if (currentView === "home") {
      fetchTodaySessions();
      fetchWeekSessions();
      fetchCourses();
      fetchNotifications();
      fetchUpcomingSessions();
    }
  }, [
    currentView,
    fetchTodaySessions,
    fetchWeekSessions,
    fetchCourses,
    fetchNotifications,
    fetchUpcomingSessions,
  ]);

  const handleMarkAllRead = async () => {
    try {
      await userNotificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

  const handleClearAll = async () => {
    try {
      await userNotificationsApi.clearAll();
      setNotifications([]);
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  };

  const handleViewAttendance = (sessionId: string, sessionInfo?: { scheduledAt: string; durationMinutes: number; title: string; type: string; status: string; courseId: string; zoomLink: string | null }) => {
    setSelectedSessionId(sessionId);
    if (sessionInfo) {
      setSelectedSessionInfo(sessionInfo);
    } else {
      const allSessions = [...todaySessions, ...weekSessions, ...upcomingSessions];
      const session = allSessions.find((s) => s.id === sessionId);
      setSelectedSessionInfo(session ? { scheduledAt: session.scheduledAt, durationMinutes: session.durationMinutes, title: session.title, type: session.type, status: session.status, courseId: session.courseId, zoomLink: session.zoomLink } : null);
    }
    setCurrentView("attendance");
  };

  const handleViewSubmissions = (assessmentId: string) => {
    setSelectedAssessmentId(assessmentId);
    setCurrentView("submissions");
  };

  const handleBackToSessions = () => {
    setSelectedSessionId(null);
    setSelectedAssessmentId(null);
    setCurrentView("sessions");
  };

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

  const getCourseStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      approved: "bg-green-50 text-green-700",
      pre_assigned: "bg-blue-50 text-blue-700",
      suggested: "bg-yellow-50 text-yellow-700",
      rejected: "bg-red-50 text-red-700",
      active: "bg-green-50 text-green-700",
      completed: "bg-blue-50 text-blue-700",
    };
    return map[status] || "bg-gray-50 text-gray-600";
  };

  const getCourseStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      approved: "Assigned",
      pre_assigned: "Pre-assigned",
      suggested: "Suggested",
      rejected: "Rejected",
      active: "Active",
      completed: "Completed",
    };
    return map[status] || status;
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString(
      locale === "ar" ? "ar-SA" : "en-US",
      { hour: "2-digit", minute: "2-digit" }
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      locale === "ar" ? "ar-SA" : "en-US",
      { weekday: "short", month: "short", day: "numeric" }
    );
  };

  const kpiCards = [
    {
      label: t("home.kpi.assignedCourses"),
      value: courses.filter((c) => c.status === "approved").length,
      icon: BookOpen,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D4A520]",
    },
    {
      label: t("home.kpi.todaysSessions"),
      value: todaySessions.length,
      icon: Calendar,
      iconBg: "bg-[#DBEAFE]",
      iconColor: "text-[#3B82F6]",
    },
    {
      label: t("home.kpi.thisWeek"),
      value: weekSessions.length,
      icon: CalendarDays,
      iconBg: "bg-[#CCFBF1]",
      iconColor: "text-[#0D9488]",
    },
    {
      label: t("home.kpi.upcoming"),
      value: upcomingSessions.length,
      icon: Clock,
      iconBg: "bg-[#E0E7FF]",
      iconColor: "text-[#6366F1]",
    },
  ];

  const renderHome = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1F2937]">{t("home.title")}</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="bg-white rounded-xl border border-[var(--color-border)] p-4 flex flex-col gap-3"
            >
              <div
                className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center`}
              >
                <Icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
              <div>
                <p className="text-sm text-[#6B7280]">{card.label}</p>
                <p className="text-2xl font-bold text-[#1F2937]">
                  {loading ? "—" : card.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two-column layout: Main + Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Sessions */}
          <div>
            <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
              {t("home.todaysSessions")}
            </h2>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : todaySessions.length === 0 ? (
              <div className="bg-white rounded-xl border border-[var(--color-border)] p-8 text-center">
                <Calendar className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" />
                <p className="text-[#6B7280]">{t("home.noSessions")}</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {todaySessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-white rounded-xl border border-[var(--color-border)] p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-[#1F2937]">
                          {session.title}
                        </h3>
                        <p className="text-sm text-[#6B7280] mt-0.5">
                          {session.courseName}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(session.status)}`}
                      >
                        {session.status === "live" && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mr-1.5" />
                        )}
                        {t(`sessions.${session.status}`)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-[#6B7280] mb-4">
                      <span className="flex items-center gap-1.5">
                        {getTypeIcon(session.type)}
                        {session.type}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {formatTime(session.scheduledAt)} (
                        {session.durationMinutes} {t("sessions.minutes")})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
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
                          className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <Video className="w-4 h-4" />
                          {t("sessions.joinZoom")}
                        </button>
                      )}
                      {(session.status === "live" ||
                        session.status === "ended" ||
                        session.status === "completed") && (
                        <button
                          onClick={() => handleViewAttendance(session.id, { scheduledAt: session.scheduledAt, durationMinutes: session.durationMinutes, title: session.title, type: session.type, status: session.status, courseId: session.courseId, zoomLink: session.zoomLink })}
                          className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] text-[#1F2937] rounded-lg text-sm font-medium hover:bg-[#F9FAFB] transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          {t("sessions.viewAttendance")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Weekly Calendar - same widget as instructor dashboard */}
          <SessionsCalendarWidget
            readOnly
            sessions={[...todaySessions, ...weekSessions, ...upcomingSessions]
              .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i)
              .map((s) => {
                const scheduledDate = new Date(s.scheduledAt);
                const endDate = new Date(scheduledDate.getTime() + s.durationMinutes * 60 * 1000);
                const formatTime = (d: Date) =>
                  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
                return {
                  id: s.id,
                  title: s.title,
                  time: `${formatTime(scheduledDate)} - ${formatTime(endDate)}`,
                  duration: `${s.durationMinutes} mins`,
                  type: s.type as "zoom" | "onsite" | "hybrid",
                  status: s.status as "scheduled" | "live" | "ended" | "completed" | "cancelled",
                  venue: s.roomName || s.venueAddress || undefined,
                  enrolled: 0,
                  dayIndex: scheduledDate.getDay(),
                  date: scheduledDate.toLocaleDateString("en-CA"),
                };
              })}
          />
        </div>

        {/* Right Sidebar Widgets */}
        <div className="space-y-4">
          {/* Notifications Widget */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-[#1F2937]">
                  {t("home.notifications.title")}
                </h3>
                {unreadCount > 0 && (
                  <span className="text-xs font-medium text-[#3B82F6] bg-[#EFF6FF] px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              {notifications.length > 0 && (
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors"
                    >
                      {t("home.notifications.markAllRead")}
                    </button>
                  )}
                  <button
                    onClick={handleClearAll}
                    className="text-[11px] text-[#6B7280] hover:text-[#EF4444] font-medium transition-colors"
                  >
                    {t("home.notifications.clearAll")}
                  </button>
                </div>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3">
                  <Bell className="w-6 h-6 text-[#9CA3AF]" />
                </div>
                <h4 className="text-sm font-medium text-[#1F2937] mb-1">
                  {t("home.notifications.noNotificationsTitle")}
                </h4>
                <p className="text-xs text-[#6B7280] text-center max-w-[200px]">
                  {t("home.notifications.noNotificationsDescription")}
                </p>
              </div>
            ) : (
              <div className="max-h-[320px] overflow-y-auto space-y-2 scrollbar-thin">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      !notification.isRead
                        ? "bg-[#EFF6FF] border-[#DBEAFE]"
                        : "bg-[#F9FAFB] border-transparent hover:border-[var(--color-border)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-medium text-[#1F2937] leading-tight">
                        {notification.title}
                      </h4>
                      {!notification.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#3B82F6] flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-[#6B7280] leading-relaxed line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <Clock className="w-3 h-3 text-[#9CA3AF]" />
                      <span className="text-[11px] text-[#9CA3AF]">
                        {formatRelativeDate(notification.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Sessions Widget */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-[#1F2937]">
                {t("home.upcomingSessions.title")}
              </h3>
              <Link
                href={`/${locale}/dashboard/teaching-assistant/sessions`}
                className="text-xs text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors"
              >
                {t("home.upcomingSessions.viewAll")} &rarr;
              </Link>
            </div>

            {upcomingSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3">
                  <Calendar className="w-6 h-6 text-[#9CA3AF]" />
                </div>
                <p className="text-xs text-[#6B7280] text-center">
                  {t("home.upcomingSessions.noUpcoming")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingSessions.slice(0, 3).map((session) => (
                  <div
                    key={session.id}
                    className="p-3 bg-[#F9FAFB] rounded-lg border border-transparent hover:border-[var(--color-border)] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className="text-sm font-medium text-[#1F2937] leading-tight">
                        {session.title}
                      </h4>
                      <span className="flex-shrink-0">
                        {getTypeIcon(session.type)}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280] mb-1.5">
                      {session.courseName}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-[#9CA3AF]">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {formatDate(session.scheduledAt)} &middot;{" "}
                        {formatTime(session.scheduledAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Courses Quick View */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-[#1F2937]">
                {t("home.coursesOverview.title")}
              </h3>
              <Link
                href={`/${locale}/dashboard/teaching-assistant/courses`}
                className="text-xs text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors"
              >
                {t("home.coursesOverview.viewAll")} &rarr;
              </Link>
            </div>

            {courses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3">
                  <BookOpen className="w-6 h-6 text-[#9CA3AF]" />
                </div>
                <p className="text-xs text-[#6B7280] text-center">
                  {t("home.coursesOverview.noCourses")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {courses.slice(0, 5).map((course) => (
                  <div
                    key={course.id}
                    className="p-3 bg-[#F9FAFB] rounded-lg border border-transparent hover:border-[var(--color-border)] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-sm font-medium text-[#1F2937] leading-tight">
                        {course.courseTitle}
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${getCourseStatusBadge((course as any).courseStatus || course.status)}`}
                      >
                        {getCourseStatusLabel((course as any).courseStatus || course.status)}
                      </span>
                    </div>
                    {(course.instructorFirstName ||
                      course.instructorLastName) && (
                      <p className="text-xs text-[#9CA3AF]">
                        {`${course.instructorFirstName || ""} ${course.instructorLastName || ""}`.trim()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (currentView) {
      case "home":
        return renderHome();
      case "sessions":
        return (
          <TASessionsContent
            onViewAttendance={handleViewAttendance}
            onViewSubmissions={handleViewSubmissions}
          />
        );
      case "attendance":
        return (
          <TAAttendanceView
            sessionId={selectedSessionId!}
            sessionTitle={selectedSessionInfo?.title}
            sessionType={selectedSessionInfo?.type}
            sessionStatus={selectedSessionInfo?.status}
            sessionCourseId={selectedSessionInfo?.courseId}
            sessionScheduledAt={selectedSessionInfo?.scheduledAt}
            sessionDurationMinutes={selectedSessionInfo?.durationMinutes}
            sessionZoomLink={selectedSessionInfo?.zoomLink}
            onBack={handleBackToSessions}
          />
        );
      case "submissions":
        return (
          <TAAssessmentSubmissionsView
            assessmentId={selectedAssessmentId!}
            onBack={handleBackToSessions}
          />
        );
      default:
        return renderHome();
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <TANavbar />
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="hidden lg:block">
            <TASidebar />
          </div>
          <div className="flex-1 min-w-0">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
};

export default TADashboardContent;
