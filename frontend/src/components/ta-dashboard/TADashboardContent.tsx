"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Video, Eye, Clock, Calendar, MapPin, Monitor, Users } from "lucide-react";
import TASidebar from "./TASidebar";
import TANavbar from "./TANavbar";
import TASessionsContent from "./TASessionsContent";
import TAAttendanceView from "./TAAttendanceView";
import TAAssessmentSubmissionsView from "./TAAssessmentSubmissionsView";
import { taApi } from "@/lib/api";

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
}

const TADashboardContent = ({ initialView = "home" }: TADashboardContentProps) => {
  const t = useTranslations("taDashboard");
  const locale = useLocale();
  const [currentView, setCurrentView] = useState<TAView>(initialView);
  const [todaySessions, setTodaySessions] = useState<AssignedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);

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

  useEffect(() => {
    if (currentView === "home") {
      fetchTodaySessions();
    }
  }, [currentView, fetchTodaySessions]);

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

  const renderHome = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1F2937]">{t("home.title")}</h1>

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
                </div>
              </div>
            ))}
          </div>
        )}
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
