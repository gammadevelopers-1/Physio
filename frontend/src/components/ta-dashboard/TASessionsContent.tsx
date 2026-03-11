"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Video, Eye, Clock, Calendar, MapPin, Monitor, FileText, Search } from "lucide-react";
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

const TASessionsContent = ({ onViewAttendance, onViewSubmissions }: TASessionsContentProps) => {
  const t = useTranslations("taDashboard");
  const locale = useLocale();
  const [sessions, setSessions] = useState<AssignedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const params: { status?: string; courseId?: string; dateRange?: string } = {};
      if (statusFilter) params.status = statusFilter;
      if (courseFilter) params.courseId = courseFilter;
      if (dateFilter) {
        const start = new Date(dateFilter);
        const end = new Date(dateFilter);
        end.setDate(end.getDate() + 1);
        params.dateRange = `${start.toISOString()},${end.toISOString()}`;
      }
      const data = await taApi.getMyAssignedSessions(params);
      setSessions(data);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, courseFilter, dateFilter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const uniqueCourses = Array.from(
    new Map(sessions.map((s) => [s.courseId, s.courseName])).entries()
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

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      time: date.toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1F2937]">{t("sessions.title")}</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#002D87]/20"
        >
          <option value="">{t("sessions.allStatuses")}</option>
          <option value="scheduled">{t("sessions.scheduled")}</option>
          <option value="live">{t("sessions.live")}</option>
          <option value="ended">{t("sessions.ended")}</option>
          <option value="completed">{t("sessions.completed")}</option>
        </select>

        {uniqueCourses.length > 1 && (
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#002D87]/20"
          >
            <option value="">{t("sessions.allCourses")}</option>
            {uniqueCourses.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        )}

        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#002D87]/20"
        />
        {dateFilter && (
          <button
            onClick={() => setDateFilter("")}
            className="px-3 py-2 text-sm text-[#6B7280] hover:text-[#1F2937] transition-colors"
          >
            {t("sessions.clearDate")}
          </button>
        )}
      </div>

      {/* Sessions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#002D87] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
          <Search className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" />
          <p className="text-[#6B7280]">{t("sessions.noSessions")}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => {
            const { date, time } = formatDateTime(session.scheduledAt);
            return (
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

                <div className="flex flex-wrap items-center gap-4 text-sm text-[#6B7280] mb-4">
                  <span className="flex items-center gap-1.5">
                    {getTypeIcon(session.type)}
                    {session.type}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {date}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {time} ({session.durationMinutes} {t("sessions.minutes")})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {session.status === "live" && session.zoomLink && (
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
                      onClick={() => onViewAttendance(session.id)}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] text-[#1F2937] rounded-lg text-sm font-medium hover:bg-[#F9FAFB] transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      {t("sessions.viewAttendance")}
                    </button>
                  )}
                  {session.assessmentId && (
                    <button
                      onClick={() => onViewSubmissions(session.assessmentId!)}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] text-[#1F2937] rounded-lg text-sm font-medium hover:bg-[#F9FAFB] transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      {t("sessions.viewSubmissions")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TASessionsContent;
