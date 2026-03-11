"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Video, Eye, Clock, Calendar, MapPin, Monitor, Users, BookOpen, AlertTriangle, FileText } from "lucide-react";
import TASidebar from "./TASidebar";
import TANavbar from "./TANavbar";
import TASessionsContent from "./TASessionsContent";
import TAAttendanceView from "./TAAttendanceView";
import TAAssessmentSubmissionsView from "./TAAssessmentSubmissionsView";
import { taApi, type TAAssignedCourse } from "@/lib/api";

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

const TADashboardContent = ({ initialView = "home" }: TADashboardContentProps) => {
  const t = useTranslations("taDashboard");
  const locale = useLocale();
  const [currentView, setCurrentView] = useState<TAView>(initialView);
  const [todaySessions, setTodaySessions] = useState<AssignedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [myCourses, setMyCourses] = useState<TAAssignedCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [weekSessions, setWeekSessions] = useState<AssignedSession[]>([]);

  const fetchTodaySessions = useCallback(async () => {
    try {
      setLoading(true);
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
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

  const fetchMyCourses = useCallback(async () => {
    try {
      setCoursesLoading(true);
      const data = await taApi.getMyAssignedCourses();
      setMyCourses(data.filter((c) => c.status !== "rejected"));
    } catch {
      setMyCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  const fetchWeekSessions = useCallback(async () => {
    try {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek);
      const endOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (7 - dayOfWeek));
      const data = await taApi.getMyAssignedSessions({
        dateRange: `${startOfWeek.toISOString()},${endOfWeek.toISOString()}`,
      });
      setWeekSessions(data);
    } catch {
      setWeekSessions([]);
    }
  }, []);

  useEffect(() => {
    if (currentView === "home") {
      fetchTodaySessions();
      fetchMyCourses();
      fetchWeekSessions();
    }
  }, [currentView, fetchTodaySessions, fetchMyCourses, fetchWeekSessions]);

  const handleViewAttendance = (sessionId: string) => {
    setSelectedSessionId(sessionId);
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

  const handleBackToHome = () => {
    setSelectedSessionId(null);
    setSelectedAssessmentId(null);
    setCurrentView("home");
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

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getCourseStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-50 text-green-700 border border-green-200";
      case "pre_assigned":
        return "bg-amber-50 text-amber-700 border border-amber-200";
      case "suggested":
        return "bg-orange-50 text-orange-700 border border-orange-200";
      default:
        return "bg-gray-50 text-gray-700 border border-gray-200";
    }
  };

  const getCourseStatusLabel = (status: string) => {
    switch (status) {
      case "approved":
        return t("courses.active");
      case "pre_assigned":
        return t("courses.preAssigned");
      case "suggested":
        return t("courses.pendingApproval");
      default:
        return status;
    }
  };

  const renderHome = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1F2937]">{t("home.title")}</h1>

      {/* My Courses */}
      <div>
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
          {t("home.myCourses")}
        </h2>

        {coursesLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-[#002D87] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : myCourses.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
            <BookOpen className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" />
            <p className="text-[#6B7280]">{t("home.noCourses")}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {myCourses.map((course) => (
              <div
                key={course.id}
                className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-base font-semibold text-[#1F2937] flex-1 min-w-0 truncate">
                    {course.courseTitle}
                  </h3>
                  <span
                    className={`ml-2 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getCourseStatusBadge(course.status)}`}
                  >
                    {getCourseStatusLabel(course.status)}
                  </span>
                </div>

                {(course.instructorFirstName || course.instructorLastName) && (
                  <p className="text-sm text-[#6B7280] mb-2">
                    <span className="font-medium">{t("courses.instructor")}:</span>{" "}
                    {course.instructorFirstName} {course.instructorLastName}
                  </p>
                )}

                <p className="text-xs text-[#9CA3AF]">
                  {t("courses.assignedOn")}{" "}
                  {new Date(course.assignedAt).toLocaleDateString(
                    locale === "ar" ? "ar-SA" : "en-US",
                    { year: "numeric", month: "short", day: "numeric" }
                  )}
                </p>

                {course.status === "pre_assigned" && (
                  <p className="text-xs text-amber-600 mt-2">
                    {t("courses.activatesAtThreshold")}
                  </p>
                )}

                {course.deactivationScheduledAt && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-2">
                    <AlertTriangle className="w-3 h-3" />
                    {t("courses.deactivationPending")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's Sessions */}
      <div>
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
          {t("home.todaysSessions")}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#002D87] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : todaySessions.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
            <Calendar className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" />
            <p className="text-[#6B7280]">{t("home.noSessions")}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {todaySessions.map((session) => (
              <div
                key={session.id}
                className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:shadow-md transition-shadow"
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
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(session.status)}`}>
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
                    {formatTime(session.scheduledAt)} ({session.durationMinutes} {t("sessions.minutes")})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {(session.status === "live") && session.zoomLink && (
                    <a
                      href={session.zoomLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#002D87] text-white rounded-lg text-sm font-medium hover:bg-[#001d5e] transition-colors"
                    >
                      <Video className="w-4 h-4" />
                      {t("sessions.joinZoom")}
                    </a>
                  )}
                  {(session.status === "live" || session.status === "ended" || session.status === "completed") && (
                    <button
                      onClick={() => handleViewAttendance(session.id)}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] text-[#1F2937] rounded-lg text-sm font-medium hover:bg-[#F9FAFB] transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      {t("sessions.viewAttendance")}
                    </button>
                  )}
                  {session.assessmentId && (
                    <button
                      onClick={() => handleViewSubmissions(session.assessmentId!)}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] text-[#1F2937] rounded-lg text-sm font-medium hover:bg-[#F9FAFB] transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      {t("sessions.viewSubmissions")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Calendar */}
      {weekSessions.length > 0 && (() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const weekDays = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek + i);
          return d;
        });
        const dayNames = weekDays.map((d) =>
          d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { weekday: "short" })
        );
        const sessionsByDay = weekDays.map((d) => {
          const dayStr = d.toISOString().slice(0, 10);
          return weekSessions.filter((s) => s.scheduledAt.slice(0, 10) === dayStr);
        });

        return (
          <div>
            <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
              {t("home.weeklyCalendar")}
            </h2>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((d, i) => {
                const isToday = d.toDateString() === today.toDateString();
                const count = sessionsByDay[i].length;
                return (
                  <div
                    key={i}
                    className={`rounded-xl border p-3 text-center ${
                      isToday
                        ? "bg-[#002D87] text-white border-[#002D87]"
                        : "bg-white border-[#E5E7EB]"
                    }`}
                  >
                    <p className={`text-xs font-medium ${isToday ? "text-white/80" : "text-[#6B7280]"}`}>
                      {dayNames[i]}
                    </p>
                    <p className={`text-lg font-bold mt-1 ${isToday ? "text-white" : "text-[#1F2937]"}`}>
                      {d.getDate()}
                    </p>
                    {count > 0 && (
                      <div className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        isToday
                          ? "bg-white/20 text-white"
                          : "bg-[#EFF6FF] text-[#3B82F6]"
                      }`}>
                        {count} {count === 1 ? t("home.session") : t("home.sessionPlural")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
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
